import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  Item,
  ItemListResponse,
  CreateItemRequest,
  UpdateItemRequest,
  ItemDisposition,
} from '@shared/api.interface';
import { FeishuService, type BitableItemFields } from '../feishu/feishu.service';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(private readonly feishuService: FeishuService) {}

  private get client() {
    return this.feishuService.getClient();
  }

  private get appToken() {
    return this.feishuService.appToken;
  }

  private get tableId() {
    return this.feishuService.tableId;
  }

  private dispositionToText(d: ItemDisposition): string {
    if (d === 'discard') return '丢弃';
    if (d === 'recycle') return '回收';
    return '保留';
  }

  private readonly LOCATION_MAP: Record<string, string> = {
    '1': '客厅',
    '2': '卧室',
    '3': '储物柜',
  };

  private resolveLocation(raw: unknown): string {
    const s = Array.isArray(raw) && raw.length > 0 ? String(raw[0] ?? '') : String(raw ?? '');
    const trimmed = s.trim();
    if (!trimmed) return '';
    if (/^\d+$/.test(trimmed)) {
      return this.LOCATION_MAP[trimmed] ?? `位置${trimmed}`;
    }
    return trimmed;
  }

  private fieldsToItem(fields: BitableItemFields): Item {
    const attachments = (fields as unknown as Record<string, unknown>)['物品图片'] as Array<{ url?: string }> | undefined;
    const f = fields as unknown as Record<string, unknown>;
    const idRaw = f['编号'] ?? f['编号id'] ?? f['id'];
    const nameRaw = f['物品名称'] ?? f['名称'];
    const signalRaw = f['强度'] ?? f['信号强度'];
    const timeRaw = f['时间'] ?? f['上报时间'];
    const storedRaw = f['是否存入'] ?? f['已存入'];
    const dispositionRaw = f['去向'] ?? f['处置状态'] ?? f['disposition'];
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

    const getDisposition = (v: unknown): ItemDisposition => {
      const s = getText(v);
      if (s === '丢弃' || s === 'discard') return 'discard';
      if (s === '回收' || s === 'recycle') return 'recycle';
      return 'keep';
    };

    const isStored = getBool(storedRaw);
    const rawLocation = this.resolveLocation(locationRaw);

    return {
      id: getText(idRaw),
      name: getText(nameRaw),
      signalStrength: signalRaw != null ? Number(signalRaw) : 0,
      reportTime: getTime(timeRaw),
      isStored,
      imageUrl: attachments?.[0]?.url ?? '',
      deviceId: getText(deviceRaw),
      disposition: getDisposition(dispositionRaw),
      location: isStored ? rawLocation : '',
    };
  }

  private buildFilter(search?: string, isStored?: boolean): string | undefined {
    const conditions: string[] = [];
    if (search) {
      const escaped = search.replace(/"/g, '\\"');
      conditions.push(
        `OR(CONTAINS(CurrentValue.[编号],"${escaped}"), CONTAINS(CurrentValue.[物品名称],"${escaped}"))`,
      );
    }
    if (isStored !== undefined) {
      conditions.push(`CurrentValue.[是否存入]=${isStored ? '1' : '0'}`);
    }
    if (conditions.length === 0) return undefined;
    return conditions.join('&');
  }

  async findAll(
    search?: string,
    isStored?: boolean,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<ItemListResponse> {
    const filter = this.buildFilter(search, isStored);
    const allItems: Item[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.client.bitable.appTableRecord.list({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter: filter || undefined,
        },
      });

      if (res.code !== 0) {
        throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
      }

      const data = res.data ?? { items: [], page_token: undefined };
      const rawItems = (data.items ?? []) as unknown as Array<{ fields: BitableItemFields }>;
      for (const it of rawItems) {
        allItems.push(this.fieldsToItem(it.fields));
      }
      pageToken = (data as unknown as { page_token?: string }).page_token;
    } while (pageToken);

    const validItems = allItems.filter((it: Item) => {
      if (!it.id || it.id.trim() === '') return false;
      return true;
    });

    const dedupMap = new Map<string, Item>();
    for (const it of validItems) {
      const existing = dedupMap.get(it.id);
      if (!existing) {
        dedupMap.set(it.id, { ...it });
        continue;
      }
      const itTime = new Date(it.reportTime).getTime();
      const exTime = new Date(existing.reportTime).getTime();
      if (itTime > exTime) {
        dedupMap.set(it.id, { ...it });
      }
    }

    const deduped = Array.from(dedupMap.values());
    deduped.sort((a: Item, b: Item) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());

    const total = deduped.length;
    const start = (page - 1) * pageSize;
    const items = deduped.slice(start, start + pageSize);

    return { items, total };
  }

  async findAllRaw(limit: number = 100): Promise<{ items: Item[]; total: number }> {
    const allItems: Item[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.client.bitable.appTableRecord.list({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
        },
      });

      if (res.code !== 0) {
        throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
      }

      const data = res.data ?? { items: [], page_token: undefined };
      const rawItems = (data.items ?? []) as unknown as Array<{ fields: BitableItemFields }>;
      for (const it of rawItems) {
        allItems.push(this.fieldsToItem(it.fields));
      }
      pageToken = (data as unknown as { page_token?: string }).page_token;
    } while (pageToken);

    const validItems = allItems.filter((it: Item) => {
      if (!it.id || it.id.trim() === '') return false;
      return true;
    });

    const dedupMap = new Map<string, Item>();
    for (const it of validItems) {
      const existing = dedupMap.get(it.id);
      if (!existing) {
        dedupMap.set(it.id, { ...it });
        continue;
      }
      const itTime = new Date(it.reportTime).getTime();
      const exTime = new Date(existing.reportTime).getTime();
      if (itTime > exTime) {
        dedupMap.set(it.id, { ...it });
      }
    }

    const deduped = Array.from(dedupMap.values());
    deduped.sort((a: Item, b: Item) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());

    const items = deduped.slice(0, limit);
    return { items, total: deduped.length };
  }

  async findPendingEntry(pageSize: number = 20): Promise<{ items: Item[]; total: number }> {
    const res = await this.client.bitable.appTableRecord.list({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
      },
      params: {
        page_size: 100,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const data = res.data ?? { items: [], total: 0 };
    const rawItems = (data.items ?? []) as unknown as Array<{ fields: BitableItemFields }>;
    const allItems: Item[] = rawItems.map((it: { fields: BitableItemFields }) =>
      this.fieldsToItem(it.fields),
    );
    const pending = allItems.filter((it: Item) => !it.name || it.name.trim() === '');
    pending.sort((a: Item, b: Item) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());
    const total = pending.length;
    const limited = pending.slice(0, pageSize);

    return { items: limited, total };
  }

  async quickEntry(id: string, name: string, isStored: boolean = false): Promise<Item> {
    const record = await this.findRecordByCodeId(id);
    if (!record) {
      throw new NotFoundException(`贴纸 ${id} 不存在`);
    }

    const fields: Partial<Record<string, unknown>> = {
      '物品名称': name,
      '是否存入': isStored ? 1 : 0,
    };

    const res = await this.client.bitable.appTableRecord.update({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
        record_id: record.record_id,
      },
      data: {
        fields: fields as Record<string, unknown>,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const merged: BitableItemFields = {
      ...record.fields,
      '物品名称': name as never,
      '是否存入': (isStored ? 1 : 0) as never,
    };

    if (name && name.trim()) {
      void this.syncNameAcrossSameId(id, name).catch((syncErr: unknown) => {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
        this.logger.warn(`同编号名称同步失败 [${id}]: ${msg}`);
      });
    }

    return this.fieldsToItem(merged);
  }

  private async findRecordByCodeId(id: string): Promise<{ record_id: string; fields: BitableItemFields } | null> {
    const filter = `CurrentValue.[编号]="${id.replace(/"/g, '\\"')}"`;
    const res = await this.client.bitable.appTableRecord.list({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
      },
      params: {
        page_size: 100,
        filter,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const records = (res.data?.items ?? []) as unknown as Array<{ record_id: string; fields: BitableItemFields }>;
    if (records.length === 0) return null;
    records.sort((a: { fields: BitableItemFields }, b: { fields: BitableItemFields }) => {
      const ta = Number((a.fields as unknown as Record<string, unknown>)['时间'] ?? 0);
      const tb = Number((b.fields as unknown as Record<string, unknown>)['时间'] ?? 0);
      return tb - ta;
    });
    return records[0];
  }

  async findOne(id: string): Promise<Item> {
    const record = await this.findRecordByCodeId(id);
    if (!record) {
      throw new NotFoundException(`物品 ${id} 不存在`);
    }
    return this.fieldsToItem(record.fields);
  }

  async create(dto: CreateItemRequest): Promise<Item> {
    const existing = await this.findRecordByCodeId(dto.id);
    if (existing) {
      const existingItem = this.fieldsToItem(existing.fields);
      const fields: Partial<Record<string, unknown>> = {
        '强度': dto.signalStrength ?? existingItem.signalStrength,
        '时间': Date.now(),
        '是否存入': dto.isStored !== undefined ? (dto.isStored ? 1 : 0) : (existingItem.isStored ? 1 : 0),
      };
      if (dto.name !== undefined && dto.name !== existingItem.name) {
        fields['物品名称'] = dto.name;
      }
      if (dto.imageUrl !== undefined) fields['物品图片'] = [{ url: dto.imageUrl }];
      if (dto.location !== undefined) fields['存入位置'] = dto.location;

      const res = await this.client.bitable.appTableRecord.update({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
          record_id: existing.record_id,
        },
        data: { fields: fields as Record<string, unknown> },
      });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const refreshed = await this.findRecordByCodeId(dto.id);
    if (!refreshed) {
      throw new BadRequestException('记录更新后读取失败');
    }
    return this.fieldsToItem(refreshed.fields);
  }

    const fields: Partial<Record<string, unknown>> = {
      '编号': dto.id,
      '物品名称': dto.name,
      '强度': dto.signalStrength ?? 0,
      '时间': Date.now(),
      '是否存入': dto.isStored ?? true ? 1 : 0,
    };

    if (dto.imageUrl !== undefined) fields['物品图片'] = [{ url: dto.imageUrl }];
    if (dto.location !== undefined) fields['存入位置'] = dto.location;

    const res = await this.client.bitable.appTableRecord.create({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
      },
      data: {
        fields: fields as Record<string, unknown>,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const created = (res.data?.record ?? { fields }) as unknown as { fields: BitableItemFields };
    return this.fieldsToItem(created.fields as BitableItemFields);
  }

  async update(id: string, dto: UpdateItemRequest): Promise<Item> {
    const record = await this.findRecordByCodeId(id);
    if (!record) {
      throw new NotFoundException(`物品 ${id} 不存在`);
    }

    const existing = this.fieldsToItem(record.fields);

    const willBeStored = dto.isStored !== undefined ? dto.isStored : existing.isStored;
    if (dto.name !== undefined && !willBeStored) {
      throw new BadRequestException('物品存入后才能命名或修改名称');
    }

    const fields: Partial<Record<string, unknown>> = {};
    if (dto.name !== undefined) fields['物品名称'] = dto.name;
    if (dto.signalStrength !== undefined) fields['强度'] = dto.signalStrength;
    if (dto.isStored !== undefined) fields['是否存入'] = dto.isStored ? 1 : 0;
    if (dto.imageUrl !== undefined) fields['物品图片'] = [{ url: dto.imageUrl }];
    if (dto.location !== undefined) fields['存入位置'] = dto.location;

    if (Object.keys(fields).length === 0) {
      return existing;
    }

    const res = await this.client.bitable.appTableRecord.update({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
        record_id: record.record_id,
      },
      data: {
        fields: fields as Record<string, unknown>,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      void this.syncNameAcrossSameId(id, dto.name).catch((syncErr: unknown) => {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
        this.logger.warn(`同编号名称同步失败 [${id}]: ${msg}`);
      });
    }

    const refreshed = await this.findRecordByCodeId(id);
    if (!refreshed) {
      throw new NotFoundException(`物品 ${id} 不存在`);
    }
    return this.fieldsToItem(refreshed.fields);
  }

  private async syncNameAcrossSameId(id: string, name: string): Promise<void> {
    const filter = `CurrentValue.[编号]="${id.replace(/"/g, '\\"')}"`;
    let pageToken: string | undefined;
    const recordIds: string[] = [];
    do {
      const res = await this.client.bitable.appTableRecord.list({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
        },
        params: {
          page_size: 100,
          page_token: pageToken,
          filter,
        },
      });
      if (res.code !== 0) {
        throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
      }
      const data = res.data ?? { items: [], page_token: undefined, has_more: false };
      const records = (data.items ?? []) as unknown as Array<{ record_id: string; fields: BitableItemFields }>;
      for (const rec of records) {
        const item = this.fieldsToItem(rec.fields);
        if (item.name !== name) {
          recordIds.push(rec.record_id);
        }
      }
      pageToken = (data as unknown as { page_token?: string }).page_token;
    } while (pageToken);

    if (recordIds.length === 0) return;

    const batchUpdate = async (ids: string[]): Promise<void> => {
      const records = ids.map((rid: string) => ({
        record_id: rid,
        fields: { '物品名称': name },
      }));
      const res = await this.client.bitable.appTableRecord.batchUpdate({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
        },
        data: { records },
      });
      if (res.code !== 0) {
        throw new BadRequestException(`飞书批量更新失败 [${res.code}]: ${res.msg}`);
      }
    };

    for (let i = 0; i < recordIds.length; i += 500) {
      await batchUpdate(recordIds.slice(i, i + 500));
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const record = await this.findRecordByCodeId(id);
    if (!record) {
      throw new NotFoundException(`物品 ${id} 不存在`);
    }

    const res = await this.client.bitable.appTableRecord.delete({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
        record_id: record.record_id,
      },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    return { success: true };
  }

  async dispositionStats(): Promise<{
    keep: number;
    discard: number;
    recycle: number;
    total: number;
  }> {
    const res = await this.client.bitable.appTableRecord.list({
      path: {
        app_token: this.appToken,
        table_id: this.tableId,
      },
      params: { page_size: 500 },
    });

    if (res.code !== 0) {
      throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
    }

    const data = res.data ?? { items: [], total: 0 };
    const rawItems = (data.items ?? []) as unknown as Array<{ fields: BitableItemFields }>;
    const f = rawItems.map((it: { fields: BitableItemFields }) => this.fieldsToItem(it.fields));

    let keep = 0;
    let discard = 0;
    let recycle = 0;
    for (const item of f) {
      if (item.disposition === 'discard') discard += 1;
      else if (item.disposition === 'recycle') recycle += 1;
      else keep += 1;
    }

    return { keep, discard, recycle, total: f.length };
  }

  async batchCreate(
    items: CreateItemRequest[],
  ): Promise<{ success: number; failed: number; failures: Array<{ id: string; name: string; error: string }>; createdItems: Item[] }> {
    if (items.length === 0) {
      return { success: 0, failed: 0, failures: [], createdItems: [] };
    }

    const allIds = items.map((it: CreateItemRequest) => it.id);
    const existingMap = new Map<string, { record_id: string; fields: BitableItemFields }>();

    const batchSize = 50;
    for (let i = 0; i < allIds.length; i += batchSize) {
      const slice = allIds.slice(i, i + batchSize);
      const conditions = slice.map((s: string) =>
        `CurrentValue.[编号]="${s.replace(/"/g, '\\"')}"`,
      );
      const filter = `OR(${conditions.join(', ')})`;
      let pageToken: string | undefined;
      do {
        const res = await this.client.bitable.appTableRecord.list({
          path: { app_token: this.appToken, table_id: this.tableId },
          params: { page_size: 100, page_token: pageToken, filter },
        });
        if (res.code !== 0) {
          this.logger.error(`批量查询现有记录失败 [${res.code}]: ${res.msg}`);
          return {
            success: 0,
            failed: items.length,
            failures: items.map((it: CreateItemRequest) => ({ id: it.id, name: it.name, error: String(res.msg) })),
            createdItems: [],
          };
        }
        const recs = (res.data?.items ?? []) as unknown as Array<{ record_id: string; fields: BitableItemFields }>;
        for (const rec of recs) {
          const f = rec.fields as unknown as Record<string, unknown>;
          const idRaw = f['编号'];
          const id = Array.isArray(idRaw) ? String(idRaw[0] ?? '') : String(idRaw ?? '');
          existingMap.set(id, rec);
        }
        pageToken = (res.data as unknown as { page_token?: string }).page_token;
      } while (pageToken);
    }

    const toCreate: CreateItemRequest[] = [];
    const toUpdate: Array<{ recordId: string; item: CreateItemRequest }> = [];

    for (const item of items) {
      const existing = existingMap.get(item.id);
      if (existing) {
        toUpdate.push({ recordId: existing.record_id, item });
      } else {
        toCreate.push(item);
      }
    }

    const resultItems: Item[] = [];
    const failures: Array<{ id: string; name: string; error: string }> = [];

    if (toCreate.length > 0) {
      const now = Date.now();
      const records = toCreate.map((item: CreateItemRequest) => {
        const fields: Record<string, unknown> = {
          '编号': item.id,
          '物品名称': item.name,
          '强度': item.signalStrength ?? 0,
          '时间': now,
          '是否存入': item.isStored ?? true ? 1 : 0,
        };
        if (item.imageUrl !== undefined) fields['物品图片'] = [{ url: item.imageUrl }];
        if (item.location !== undefined) fields['存入位置'] = item.location;
        return { fields };
      });

      const res = await this.client.bitable.appTableRecord.batchCreate({
        path: { app_token: this.appToken, table_id: this.tableId },
        data: { records },
      });

      if (res.code !== 0) {
        this.logger.error(`批量创建失败 [${res.code}]: ${res.msg}`);
        for (const it of toCreate) failures.push({ id: it.id, name: it.name, error: String(res.msg) });
      } else {
        const created = (res.data?.records ?? []) as unknown as Array<{ fields: BitableItemFields }>;
        for (const rec of created) resultItems.push(this.fieldsToItem(rec.fields));
      }
    }

    if (toUpdate.length > 0) {
      const now = Date.now();
      for (let i = 0; i < toUpdate.length; i += 500) {
        const batch = toUpdate.slice(i, i + 500);
        const records = batch.map(({ recordId, item }) => {
          const fields: Record<string, unknown> = {
            '强度': item.signalStrength ?? 0,
            '时间': now,
            '是否存入': item.isStored ?? true ? 1 : 0,
          };
          if (item.name) fields['物品名称'] = item.name;
          if (item.imageUrl !== undefined) fields['物品图片'] = [{ url: item.imageUrl }];
          if (item.location !== undefined) fields['存入位置'] = item.location;
          return { record_id: recordId, fields };
        });

        const res = await this.client.bitable.appTableRecord.batchUpdate({
          path: { app_token: this.appToken, table_id: this.tableId },
          data: { records },
        });

        if (res.code !== 0) {
          this.logger.error(`批量更新失败 [${res.code}]: ${res.msg}`);
          for (const { item } of batch) failures.push({ id: item.id, name: item.name, error: String(res.msg) });
        } else {
          const updated = (res.data?.records ?? []) as unknown as Array<{ fields: BitableItemFields }>;
          for (const rec of updated) resultItems.push(this.fieldsToItem(rec.fields));
        }
      }
    }

    return {
      success: resultItems.length,
      failed: failures.length,
      failures,
      createdItems: resultItems,
    };
  }

  async dedupBitableRecords(): Promise<{
    totalRecords: number;
    uniqueItems: number;
    merged: number;
    deleted: number;
  }> {
    const allRecords: Array<{ record_id: string; fields: BitableItemFields }> = [];
    let pageToken: string | undefined;
    do {
      const res = await this.client.bitable.appTableRecord.list({
        path: { app_token: this.appToken, table_id: this.tableId },
        params: { page_size: 100, page_token: pageToken },
      });
      if (res.code !== 0) {
        throw new BadRequestException(`飞书 API 错误 [${res.code}]: ${res.msg}`);
      }
      const data = res.data ?? { items: [], page_token: undefined };
      const records = (data.items ?? []) as unknown as Array<{ record_id: string; fields: BitableItemFields }>;
      for (const rec of records) allRecords.push(rec);
      pageToken = (data as unknown as { page_token?: string }).page_token;
    } while (pageToken);

    const byId = new Map<string, Array<{ record_id: string; fields: BitableItemFields }>>();
    for (const rec of allRecords) {
      const f = rec.fields as unknown as Record<string, unknown>;
      const idRaw = f['编号'] ?? f['编号id'] ?? f['id'];
      const id = Array.isArray(idRaw) ? String(idRaw[0] ?? '') : String(idRaw ?? '');
      if (!id || id.trim() === '') continue;
      const list = byId.get(id) ?? [];
      list.push(rec);
      byId.set(id, list);
    }

    const toDelete: string[] = [];

    for (const [, recs] of byId) {
      if (recs.length <= 1) continue;
      const getTime = (fields: BitableItemFields): number => {
        const f = fields as unknown as Record<string, unknown>;
        const raw = f['时间'] ?? f['上报时间'];
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') {
          const n = Number(raw);
          return Number.isNaN(n) ? new Date(raw).getTime() : n;
        }
        return 0;
      };

      const sorted = [...recs].sort(
        (a: { fields: BitableItemFields }, b: { fields: BitableItemFields }) => getTime(b.fields) - getTime(a.fields),
      );
      const rest = sorted.slice(1);

      for (const rec of rest) toDelete.push(rec.record_id);
    }

    let deletedCount = 0;

    if (toDelete.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const res = await this.client.bitable.appTableRecord.batchDelete({
          path: { app_token: this.appToken, table_id: this.tableId },
          data: { records: batch },
        });
        if (res.code !== 0) {
          this.logger.error(`去重删除失败 [${res.code}]: ${res.msg}`);
          break;
        }
        deletedCount += batch.length;
      }
    }

    return {
      totalRecords: allRecords.length,
      uniqueItems: byId.size,
      merged: 0,
      deleted: deletedCount,
    };
  }
}
