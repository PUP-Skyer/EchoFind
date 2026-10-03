import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, gte, lt, asc, sql } from 'drizzle-orm';
import type {
  Schedule,
  ScheduleListResponse,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleDayDot,
  ScheduleParseRequest,
  ScheduleParsedEvent,
  ScheduleParseResponse,
  ScheduleRecommendResponse,
  ScheduleRecommendItem,
  ScheduleTag,
} from '@shared/api.interface';
import { schedule } from '@server/database/schema';
import { ItemsService } from '../items/items.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly itemsService: ItemsService,
    private readonly settingsService: SettingsService,
  ) {}

  private rowToSchedule(row: typeof schedule.$inferSelect): Schedule {
    const scheduleDate = String(row.scheduleDate ?? '').slice(0, 10);

    return {
      id: row.id,
      title: row.title,
      scheduleDate,
      startTime: row.startTime ?? '09:00',
      endTime: row.endTime ?? '10:00',
      location: row.location ?? null,
      tag: (row.tag as ScheduleTag) ?? 'other',
      status: row.status as Schedule['status'] ?? 'pending',
      description: row.description ?? null,
    };
  }

  async findAll(
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ScheduleListResponse> {
    const conditions = [];

    if (date) {
      conditions.push(eq(schedule.scheduleDate, date));
    } else if (startDate && endDate) {
      conditions.push(gte(schedule.scheduleDate, startDate));
      conditions.push(lt(schedule.scheduleDate, endDate));
    }

    const query = conditions.length > 0
      ? this.db
          .select()
          .from(schedule)
          .where(and(...conditions))
          .orderBy(asc(schedule.scheduleDate), asc(schedule.startTime))
      : this.db
          .select()
          .from(schedule)
          .orderBy(asc(schedule.scheduleDate), asc(schedule.startTime));

    const rows = await query;
    const items: Schedule[] = rows.map((row) => this.rowToSchedule(row));
    return { items };
  }

  async getDayDots(month: string): Promise<{ dots: ScheduleDayDot[] }> {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthNum = Number(monthStr);

    if (
      !year || !monthNum ||
      monthNum < 1 || monthNum > 12 ||
      monthStr.length !== 2
    ) {
      throw new BadRequestException('month 参数格式错误，应为 YYYY-MM');
    }

    const monthStart = `${year}-${monthStr}-01`;
    const nextMonth = monthNum === 12 ? year + 1 : year;
    const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
    const monthEnd = `${nextMonth}-${String(nextMonthNum).padStart(2, '0')}-01`;

    const results = await this.db
      .select({
        scheduleDate: schedule.scheduleDate,
        count: sql<number>`count(*)`,
      })
      .from(schedule)
      .where(and(
        gte(schedule.scheduleDate, monthStart),
        lt(schedule.scheduleDate, monthEnd),
      ))
      .groupBy(schedule.scheduleDate)
      .orderBy(asc(schedule.scheduleDate));

    const dots: ScheduleDayDot[] = results.map((r) => ({
      date: String(r.scheduleDate ?? '').slice(0, 10),
      count: Number(r.count),
    }));

    return { dots };
  }

  async create(dto: ScheduleCreateRequest, userId: string): Promise<Schedule> {
    const title = (dto.title ?? '').trim();
    if (!title) throw new BadRequestException('日程标题不能为空');

    const startTime = dto.startTime ?? '09:00';
    const endTime = dto.endTime ?? '10:00';

    const existingRows = await this.db
      .select()
      .from(schedule)
      .where(and(
        eq(schedule.title, title),
        eq(schedule.scheduleDate, dto.scheduleDate),
        eq(schedule.startTime, startTime),
        eq(schedule.endTime, endTime),
        sql`(${schedule.owner}).user_id = ${userId}`,
      ));

    if (existingRows.length > 0) {
      const id = existingRows[0].id;
      return this.update(id, {
        title,
        location: dto.location ?? undefined,
        tag: dto.tag ?? undefined,
        status: dto.status ?? undefined,
        description: dto.description ?? undefined,
      }, userId);
    }

    const values: typeof schedule.$inferInsert = {
      title,
      scheduleDate: dto.scheduleDate,
      startTime,
      endTime,
      location: dto.location ?? null,
      tag: dto.tag ?? 'work',
      status: dto.status ?? 'pending',
      description: dto.description ?? null,
      owner: userId,
      createdBy: userId,
      updatedBy: userId,
    };

    const rows = await this.db.insert(schedule).values(values).returning();
    return this.rowToSchedule(rows[0]);
  }

  async update(id: string, dto: ScheduleUpdateRequest, userId: string): Promise<Schedule> {
    const patch: Partial<typeof schedule.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.scheduleDate !== undefined) patch.scheduleDate = dto.scheduleDate;
    if (dto.startTime !== undefined) patch.startTime = dto.startTime;
    if (dto.endTime !== undefined) patch.endTime = dto.endTime;
    if (dto.location !== undefined) patch.location = dto.location;
    if (dto.tag !== undefined) patch.tag = dto.tag;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.description !== undefined) patch.description = dto.description;

    if (Object.keys(patch).length === 0) {
      const existing = await this.db.select().from(schedule).where(eq(schedule.id, id));
      if (existing.length === 0) throw new NotFoundException('日程不存在');
      return this.rowToSchedule(existing[0]);
    }

    patch.updatedBy = userId;
    patch.updatedAt = new Date();

    const rows = await this.db
      .update(schedule)
      .set(patch)
      .where(eq(schedule.id, id))
      .returning();

    if (rows.length === 0) throw new NotFoundException('日程不存在');
    return this.rowToSchedule(rows[0]);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const rows = await this.db
      .delete(schedule)
      .where(eq(schedule.id, id))
      .returning({ id: schedule.id });

    if (rows.length === 0) throw new NotFoundException('日程不存在');
    return { success: true };
  }

  private getShanghaiToday(): string {
    const now = new Date();
    const shanghaiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = shanghaiTime.getUTCFullYear();
    const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async parse(dto: ScheduleParseRequest): Promise<ScheduleParseResponse> {
    const baseDate = dto.baseDate ?? this.getShanghaiToday();

    try {
      const systemPrompt = `你是日程整理助手。
用户会用自然语言描述日程安排（可能包含多个事件），你需要把它们拆解为结构化的日程事件列表。

基准日期：${baseDate}（YYYY-MM-DD）。"今天"指基准日期，"明天"指基准日期+1天，"后天"指基准日期+2天，依此类推。
"下周X"指基准日期之后的下一个周X（周一=1，周日=7）。
能识别"上午9点半"、"下午2点"、"晚上8点"等中文时间表达。
只给了开始时间时，默认时长为 1 小时。

输出必须是严格的 JSON 格式，结构如下：
{
  "events": [
    {
      "title": "事件标题",
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "location": "地点（没有则为空字符串）",
      "tag": "work | travel | life | other"
    }
  ],
  "reply": "一句简短的确认语，如'已添加：3个日程'"
}

tag 分类规则：
- work：工作、会议、加班、出差办公
- travel：旅行、出差、通勤、航班、火车
- life：生活、购物、健身、约会、聚餐、看病
- other：其他无法归类的

事件数量为 0 时 events 返回空数组。
reply 要简洁友好，中文回答。`;

      const cfg = this.settingsService.getModelConfigRaw();
      const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: dto.text },
          ],
          temperature: 0.3,
          max_tokens: 800,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`AI 解析日程失败 [${response.status}]: ${errText}`);
        return { events: [], reply: '暂时无法整理，手动添加试试？' };
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      let parsed: {
        events?: Array<{
          title: string;
          date: string;
          startTime: string;
          endTime: string;
          location: string;
          tag: string;
        }>;
        reply?: string;
      };
      try {
        parsed = JSON.parse(content) as typeof parsed;
      } catch {
        this.logger.warn('AI 解析日程返回非 JSON');
        return { events: [], reply: '暂时无法整理，手动添加试试？' };
      }

      const validTags: ScheduleTag[] = ['work', 'travel', 'life', 'other'];
      const events: ScheduleParsedEvent[] = (parsed.events ?? []).map((ev) => ({
        title: ev.title ?? '',
        date: ev.date ?? baseDate,
        startTime: ev.startTime ?? '09:00',
        endTime: ev.endTime ?? '10:00',
        location: ev.location ?? '',
        tag: validTags.includes(ev.tag as ScheduleTag)
          ? (ev.tag as ScheduleTag)
          : 'other',
      }));

      return {
        events,
        reply: parsed.reply ?? '已为你整理好日程啦～',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('AI 日程解析异常', msg);
      return { events: [], reply: '暂时无法整理，手动添加试试？' };
    }
  }

  async recommend(date: string): Promise<ScheduleRecommendResponse> {
    try {
      const { items: schedules } = await this.findAll(date);
      const { items: allItems } = await this.itemsService.findAll(undefined, undefined, 1, 100);

      const namedItems = allItems.filter(
        (it) => it.name && it.name.trim().length > 0,
      );

      if (schedules.length === 0) {
        return { items: [], summary: '今天没有安排，可以轻松出门～' };
      }

      const scheduleText = schedules
        .map(
          (s) =>
            `- ${s.startTime}-${s.endTime} ${s.title}${s.location ? `（${s.location}）` : ''} [${s.tag}]`,
        )
        .join('\n');

      const itemsText = namedItems.length > 0
        ? namedItems.map((it) => `- ${it.name}（${it.isStored ? '已存入' : '未存入'}）`).join('\n')
        : '（暂无物品）';

      const prompt = `今天（${date}）的日程安排：
${scheduleText}

用户的物品清单：
${itemsText}

请根据今天的日程安排，从物品清单中推荐最多 6 件"今天出门必带"的物品，并给出简短理由（10字以内）。
只推荐物品清单中已有的物品，不要编造。
输出严格 JSON 格式：
{"items": [{"name": "物品名", "reason": "理由"}], "summary": "一句话总结，不超过30字"}`;

      const cfg = this.settingsService.getModelConfigRaw();
      const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 600,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`AI 推荐失败 [${response.status}]: ${errText}`);
        return { items: [], summary: '暂无推荐' };
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      let parsed: {
        items?: Array<{ name: string; reason: string }>;
        summary?: string;
      };
      try {
        parsed = JSON.parse(content) as typeof parsed;
      } catch {
        this.logger.warn('AI 推荐返回非 JSON');
        return { items: [], summary: '暂无推荐' };
      }

      const recommendItems: ScheduleRecommendItem[] = (parsed.items ?? [])
        .slice(0, 6)
        .map((rec) => {
          const found = namedItems.find(
            (it) =>
              it.name === rec.name ||
              rec.name.includes(it.name) ||
              it.name.includes(rec.name),
          );
          const isStored = found?.isStored ?? false;
          return {
            id: found?.id ?? '',
            name: rec.name,
            isStored,
            location: isStored ? '阻隔盒(已存入)' : '附近区域',
            reason: rec.reason,
          };
        });

      return {
        items: recommendItems,
        summary: parsed.summary ?? '根据日程为你精选了必带物品～',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('日程推荐异常', msg);
      return { items: [], summary: '暂无推荐' };
    }
  }
}
