import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  DashboardStats,
  ReportRecord,
  Alert,
  DataFlowStatus,
  TrendDataPoint,
  SignalDistribution,
  StatsOverview,
  Item,
} from '@shared/api.interface';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class StatsService {
  constructor(private readonly feishuService: FeishuService) {}

  private async getAllItems(): Promise<Item[]> {
    const client = this.feishuService.getClient();
    const appToken = this.feishuService.appToken;
    const tableId = this.feishuService.tableId;
    const rawItems: Item[] = [];
    let pageToken: string | undefined;

    do {
      const res = (await client.bitable.appTableRecord.list({
        path: { app_token: appToken, table_id: tableId },
        params: { page_size: 100, page_token: pageToken },
      })) as unknown as {
        code: number;
        msg: string;
        data?: {
          items: Array<{
            record_id: string;
            fields: Record<string, unknown>;
          }>;
          page_token?: string;
          has_more?: boolean;
          total?: number;
        };
      };

      if (res.code !== 0) {
        throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
      }

      const records = res.data?.items ?? [];
      for (const rec of records) {
        const f = rec.fields;
        const attachments = (f['物品图片'] as Array<Record<string, unknown>> | undefined) ?? [];
        const imageUrl = (attachments[0]?.url as string) ?? '';
        const idRaw = f['编号'] ?? f['编号id'] ?? f['id'];
        const nameRaw = f['物品名称'] ?? f['名称'];
        const signalRaw = f['强度'] ?? f['信号强度'];
        const timeRaw = f['时间'] ?? f['上报时间'];
        const storedRaw = f['是否存入'] ?? f['已存入'];
        const deviceRaw = f['贴纸编号'] ?? f['设备ID'] ?? f['deviceId'];
        const locationRaw = f['存入位置'] ?? f['位置'] ?? f['放置位置'] ?? f['location'] ?? f['区域'];

        const getText = (v: unknown): string => {
          if (Array.isArray(v)) return v.length > 0 ? String(v[0] ?? '') : '';
          if (v == null) return '';
          return String(v);
        };
        const getBool = (v: unknown): boolean => {
          if (typeof v === 'boolean') return v;
          if (typeof v === 'number') return v !== 0;
          if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
          return Boolean(v);
        };
        const getTime = (v: unknown): string => {
          if (v == null || v === '') return new Date(0).toISOString();
          if (typeof v === 'number') return new Date(v).toISOString();
          if (typeof v === 'string') {
            const n = Number(v);
            if (!Number.isNaN(n)) return new Date(n).toISOString();
            return new Date(v).toISOString();
          }
          return new Date(0).toISOString();
        };

        rawItems.push({
          id: getText(idRaw),
          name: getText(nameRaw),
          signalStrength: signalRaw != null ? Number(signalRaw) : 0,
          reportTime: getTime(timeRaw),
          isStored: getBool(storedRaw),
          imageUrl,
          deviceId: getText(deviceRaw),
          disposition: 'keep',
          location: getText(locationRaw),
        });
      }
      pageToken = res.data?.has_more ? res.data.page_token : undefined;
    } while (pageToken);

    const validItems = rawItems.filter((it: Item) => {
      if (!it.id || it.id.trim() === '') return false;
      if (it.signalStrength <= 0) return false;
      if (!it.reportTime || it.reportTime.startsWith('1970') || it.reportTime.startsWith('0000')) return false;
      return true;
    });

    const dedupMap = new Map<string, Item>();
    for (const it of validItems) {
      const existing = dedupMap.get(it.id);
      if (!existing) {
        dedupMap.set(it.id, { ...it });
        continue;
      }
      const merged = { ...existing };
      const itTime = new Date(it.reportTime).getTime();
      const exTime = new Date(existing.reportTime).getTime();
      if (itTime > exTime) {
        merged.reportTime = it.reportTime;
        merged.signalStrength = it.signalStrength;
        merged.location = it.location || existing.location;
        merged.isStored = it.isStored;
        merged.deviceId = it.deviceId || existing.deviceId;
        merged.imageUrl = it.imageUrl || existing.imageUrl;
      }
      if (!merged.name && it.name) merged.name = it.name;
      if (!merged.imageUrl && it.imageUrl) merged.imageUrl = it.imageUrl;
      dedupMap.set(it.id, merged);
    }

    const deduped = Array.from(dedupMap.values());
    deduped.sort((a: Item, b: Item) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());
    return deduped;
  }

  async getDashboard(): Promise<DashboardStats> {
    const items = await this.getAllItems();
    const storedCount = items.filter((it: Item) => it.isStored).length;
    const lowSignal = items.filter((it: Item) => it.signalStrength < 30).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayReports = items.filter((it: Item) => it.reportTime.slice(0, 10) === today).length;

    return {
      todayReports,
      onlineDevices: Math.max(0, items.length - lowSignal),
      totalItems: items.length,
      storedItems: storedCount,
      recentAlerts: lowSignal,
      blockedDevices: lowSignal,
      offlineDevices: 0,
      dataFlowHealth: items.length > 0 ? 'healthy' : 'warning',
    };
  }

  async getRecentReports(limit: number = 10): Promise<ReportRecord[]> {
    const items = await this.getAllItems();
    const sorted = [...items].sort(
      (a: Item, b: Item) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
    );
    return sorted.slice(0, limit).map((it: Item, idx: number) => ({
      id: `RPT-${String(idx + 1).padStart(3, '0')}`,
      deviceId: it.deviceId,
      itemName: it.name,
      signalStrength: it.signalStrength,
      timestamp: it.reportTime,
      isStored: it.isStored,
      imageUrl: it.imageUrl,
    }));
  }

  async getRecentAlerts(limit: number = 5): Promise<Alert[]> {
    const items = await this.getAllItems();
    const alerts: Alert[] = [];
    let idx = 0;

    for (const item of items) {
      if (item.signalStrength < 30) {
        alerts.push({
          id: `ALT-${String(++idx).padStart(3, '0')}`,
          type: 'blocked',
          level: item.signalStrength < 10 ? 'critical' : 'warning',
          deviceId: item.deviceId || 'unknown',
          itemName: item.name,
          message: item.signalStrength < 10 ? '信号极低，疑似丢失' : '信号较弱，可能被阻隔',
          timestamp: item.reportTime,
          resolved: false,
        });
      } else if (item.signalStrength >= 30 && item.signalStrength < 50) {
        alerts.push({
          id: `ALT-${String(++idx).padStart(3, '0')}`,
          type: 'abnormal',
          level: 'info',
          deviceId: item.deviceId || 'unknown',
          itemName: item.name,
          message: '信号强度偏低',
          timestamp: item.reportTime,
          resolved: false,
        });
      }
      if (alerts.length >= limit) break;
    }

    return alerts;
  }

  async getDataFlow(): Promise<DataFlowStatus> {
    const startTime = Date.now();
    const items = await this.getAllItems();
    const latency = Date.now() - startTime;
    const today = new Date().toISOString().slice(0, 10);
    const todayReports = items.filter((it: Item) => it.reportTime.slice(0, 10) === today).length;
    const latestItem = items.length > 0
      ? items.reduce((a: Item, b: Item) => (new Date(a.reportTime) > new Date(b.reportTime) ? a : b))
      : null;

    return {
      esp32Status: items.length > 0 ? 'connected' : 'disconnected',
      feishuStatus: 'connected',
      latency,
      lastSyncTime: latestItem ? latestItem.reportTime : null,
      todayReports,
    };
  }

  async getTrend(days: number = 7): Promise<TrendDataPoint[]> {
    const items = await this.getAllItems();
    const now = Date.now();
    const result: TrendDataPoint[] = [];
    const dayMap = new Map<string, number>();

    for (const it of items) {
      const date = new Date(it.reportTime);
      if (Number.isNaN(date.getTime())) continue;
      const dateStr = date.toISOString().slice(0, 10);
      dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + 1);
    }

    for (let i: number = days - 1; i >= 0; i -= 1) {
      const date: Date = new Date(now - i * 24 * 3600_000);
      const dateStr: string = date.toISOString().slice(0, 10);
      const count: number = dayMap.get(dateStr) ?? 0;
      result.push({ date: dateStr, count: Math.max(0, count) });
    }
    return result;
  }

  async getSignalDistribution(): Promise<SignalDistribution[]> {
    const items = await this.getAllItems();
    const ranges = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '20-40', min: 20, max: 40, count: 0 },
      { range: '40-60', min: 40, max: 60, count: 0 },
      { range: '60-80', min: 60, max: 80, count: 0 },
      { range: '80-100', min: 80, max: 101, count: 0 },
    ];
    for (const it of items) {
      const s = it.signalStrength;
      for (const r of ranges) {
        if (s >= r.min && s < r.max) {
          r.count += 1;
          break;
        }
      }
    }
    return ranges.map((r) => ({ range: r.range, count: r.count }));
  }

  async getOverview(): Promise<StatsOverview> {
    const items = await this.getAllItems();
    const trend: TrendDataPoint[] = await this.getTrend(7);
    const signalDistribution: SignalDistribution[] = await this.getSignalDistribution();
    const onlineCount = items.filter((it: Item) => it.signalStrength >= 50).length;
    return {
      reportTrend: trend,
      deviceOnlineRate: items.length > 0 ? Math.round((onlineCount / items.length) * 1000) / 10 : 0,
      signalDistribution,
      totalDevices: items.length,
      onlineDevices: onlineCount,
    };
  }
}
