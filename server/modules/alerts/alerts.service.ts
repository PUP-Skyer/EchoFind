import { Injectable, NotFoundException } from '@nestjs/common';
import type { Alert, AlertListResponse, OperationLog, Item } from '@shared/api.interface';
import { FeishuService } from '../feishu/feishu.service';

type AlertType = Alert['type'];
type AlertLevel = Alert['level'];

@Injectable()
export class AlertsService {
  private logs: OperationLog[] = [];

  constructor(private readonly feishuService: FeishuService) {
    const now = Date.now();
    this.logs = [
      { id: 'LOG-001', operator: '管理员', action: '同步飞书表格', target: '物品信息表', timestamp: new Date(now - 10 * 60_000).toISOString() },
      { id: 'LOG-002', operator: '系统', action: '自动同步', target: '飞书多维表格', timestamp: new Date(now - 120 * 60_000).toISOString() },
      { id: 'LOG-003', operator: '管理员', action: '配置飞书连接', target: 'appId 更新', timestamp: new Date(now - 300 * 60_000).toISOString() },
    ];
  }

  private async getAllItems(): Promise<Item[]> {
    const client = this.feishuService.getClient();
    const appToken = this.feishuService.appToken;
    const tableId = this.feishuService.tableId;
    const allItems: Item[] = [];
    let pageToken: string | undefined;

    do {
      const res = (await client.bitable.appTableRecord.list({
        path: { app_token: appToken, table_id: tableId },
        params: { page_size: 100, page_token: pageToken },
      })) as unknown as {
        code: number;
        msg: string;
        data?: {
          items: Array<{ record_id: string; fields: Record<string, unknown> }>;
          page_token?: string;
          has_more?: boolean;
        };
      };
      if (res.code !== 0) return allItems;
      const records = res.data?.items ?? [];
      for (const rec of records) {
        const f = rec.fields;
        const attachments = (f['物品图片'] as Array<Record<string, unknown>> | undefined) ?? [];
        allItems.push({
          id: String(f['编号'] ?? ''),
          name: String(f['物品名称'] ?? ''),
          signalStrength: Number(f['强度'] ?? 0),
          reportTime: f['时间'] ? new Date(Number(f['时间'])).toISOString() : new Date(0).toISOString(),
          isStored: Boolean(f['是否存入']),
          imageUrl: (attachments[0]?.url as string) ?? '',
          deviceId: (f['贴纸编号'] as string ?? ''),
          disposition: 'keep',
          location: String(f['位置'] ?? f['放置位置'] ?? f['location'] ?? f['区域'] ?? ''),
        });
      }
      pageToken = res.data?.has_more ? res.data.page_token : undefined;
    } while (pageToken);

    return allItems;
  }

  async findAll(
    level?: string,
    type?: string,
    resolved?: boolean,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<AlertListResponse> {
    const items = await this.getAllItems();
    const allAlerts: Alert[] = [];
    let idx = 0;

    for (const item of items) {
      const s = item.signalStrength;
      if (s < 20) {
        allAlerts.push({
          id: `ALT-${String(++idx).padStart(3, '0')}`,
          type: 'blocked',
          level: 'critical',
          deviceId: item.deviceId || 'unknown',
          itemName: item.name,
          message: '信号被阻隔，可能丢失',
          timestamp: item.reportTime,
          resolved: false,
        });
      } else if (s < 40) {
        allAlerts.push({
          id: `ALT-${String(++idx).padStart(3, '0')}`,
          type: 'abnormal',
          level: 'warning',
          deviceId: item.deviceId || 'unknown',
          itemName: item.name,
          message: '信号强度异常波动',
          timestamp: item.reportTime,
          resolved: false,
        });
      }
      if (!item.isStored) {
        allAlerts.push({
          id: `ALT-${String(++idx).padStart(3, '0')}`,
          type: 'offline',
          level: 'info',
          deviceId: item.deviceId || 'unknown',
          itemName: item.name,
          message: '未存入收纳区',
          timestamp: item.reportTime,
          resolved: false,
        });
      }
    }

    let filtered = allAlerts;
    if (level) filtered = filtered.filter((a: Alert) => a.level === level);
    if (type) filtered = filtered.filter((a: Alert) => a.type === type);
    if (resolved !== undefined) filtered = filtered.filter((a: Alert) => a.resolved === resolved);

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const alerts = filtered.slice(start, start + pageSize);
    return { alerts, total };
  }

  async resolve(id: string): Promise<Alert> {
    const res = await this.findAll();
    const alert = res.alerts.find((a: Alert) => a.id === id);
    if (!alert) throw new NotFoundException(`告警 ${id} 不存在`);
    return { ...alert, resolved: true };
  }

  async getLogs(): Promise<{ logs: OperationLog[]; total: number }> {
    return { logs: this.logs, total: this.logs.length };
  }
}
