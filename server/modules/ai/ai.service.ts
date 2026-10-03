import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ItemsService } from '../items/items.service';
import { SettingsService } from '../settings/settings.service';
import { SchedulesService } from '../schedules/schedules.service';
import type {
  AIChatRequest,
  AIChatResponse,
  AIDailyRecommendResponse,
  ScheduleTag,
  Schedule,
} from '@shared/api.interface';

const MODEL_TIMEOUT_MS = 60000;

interface ItemLite {
  id: string;
  name: string;
  isStored: boolean;
  signalStrength: number;
  imageUrl: string;
  deviceId: string;
  reportTime: string;
  location: string;
}

function inferRoom(
  isStored: boolean,
  signalStrength: number,
  baseStationRoom: string,
  strongThreshold: number,
): string {
  if (!isStored) return '未存入';
  const allRooms = ['客厅', '卧室', '储物柜'];
  const others = allRooms.filter((r: string) => r !== baseStationRoom);
  const midThreshold = strongThreshold * 0.6;
  if (signalStrength >= strongThreshold) return baseStationRoom;
  if (signalStrength >= midThreshold) return others[0] ?? baseStationRoom;
  return others[1] ?? others[0] ?? baseStationRoom;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly itemsService: ItemsService,
    private readonly settingsService: SettingsService,
    private readonly schedulesService: SchedulesService,
    private readonly httpService: HttpService,
  ) {}

  private getShanghaiToday(): string {
    const now = new Date();
    const shanghaiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = shanghaiTime.getUTCFullYear();
    const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async fetchWeather(): Promise<{ text: string; temp: number }> {
    return { text: '下雨，18°C', temp: 18 };
  }

  private async getTodaySchedules(): Promise<Schedule[]> {
    try {
      const today = this.getShanghaiToday();
      const { items } = await this.schedulesService.findAll(today);
      return items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn('获取今日日程失败', msg);
      return [];
    }
  }

  private async getUpcomingSchedules(days: number = 3): Promise<Schedule[]> {
    try {
      const today = this.getShanghaiToday();
      const { items } = await this.schedulesService.findAll();
      return items.filter((s: Schedule) => s.scheduleDate >= today);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn('获取近期日程失败', msg);
      return [];
    }
  }

  private buildContextBlock(
    weather: string,
    schedules: Schedule[],
    upcoming: Schedule[] = [],
  ): string {
    const scheduleText = schedules.length > 0
      ? schedules
          .map(
            (s: Schedule) =>
              `- ${s.startTime}-${s.endTime} ${s.title}${s.location ? `（${s.location}）` : ''} [${s.tag}]`,
          )
          .join('\n')
      : '（今日暂无安排）';

    const futureItems = upcoming.filter(
      (s: Schedule) => s.scheduleDate > this.getShanghaiToday(),
    );
    const futureText = futureItems.length > 0
      ? futureItems
          .map(
            (s: Schedule) =>
              `- ${s.scheduleDate} ${s.startTime} ${s.title}${s.location ? `（${s.location}）` : ''} [${s.tag}]`,
          )
          .join('\n')
      : '（暂无未来安排）';

    return `## 今日上下文\n### 天气\n${weather}\n\n### 今日日程\n${scheduleText}\n\n### 近期日程（含明天及以后）\n${futureText}\n`;
  }

  private buildSystemPrompt(items: string, context: string, today: string): string {
    return `你是"小寻"，一个可爱、贴心、元气满满的寻物AI助手。
你的语气要活泼、温暖，像好朋友一样和用户聊天。

今天是 ${today}（YYYY-MM-DD），用户提到"明天"就是加1天，"后天"就是加2天。

你掌管着一张"物品信息表"，里面记录着所有贴纸绑定的物品位置和状态。
当前物品库（最新数据）：
${items}

${context}

 你的能力：
 1. 用户问"XX在哪/我的XX呢/找一下XX"时，从物品库里找对应的物品，根据状态区分回答：
    - 未存入（检测不到信号）：说明物品已经被带出家门、随身带着，告诉用户"这个你随身带着呢～"，不说客厅/卧室/储物柜，也不用让用户回家拿
    - 已存入（在家检测到信号）：说明物品放在家里，告诉用户它在哪个房间（客厅/卧室/储物柜）和信号情况
 2. 用户问"今天带什么/露营要带什么/出门要带什么/我要出发了/我要出门了"等出门相关问题时，做出门推荐，**只从物品库里已登记的物品里挑选**，结合当天日程场景和天气给出相关推荐，库里没有的物品不要编造、不要列出来
    输出要给一份相关清单（从库里挑最相关的，最多6件），如果库里没有相关物品就直接说"物品库里目前没有相关物品哦"。每个物品说明：物品名 + 当前状态 + 推荐理由
 3. 出门推荐时的物品状态规则（重要）：
    - 在家检测到信号（已存入）→ 还在家里 → 说"在客厅/卧室/储物柜，记得去拿一下"
    - 检测不到信号（未存入/不在当前范围）→ 已经随身带着了 → 说"这个你已经带着了"，不要让用户回家拿、也不要说"记得自己拿"
    - 物品库里没有的物品 → 不要出现在推荐清单里，宁可少推荐也不编造
    - 如果库里完全没有相关物品 → 说"物品库里目前没有相关物品哦"
4. 用户说"这个叫XX/这是XX/登记XX/录入XX"时，识别为登记新物品的意图
5. 天气、日程相关问题，结合物品推荐"今日必带"清单
6. 添加日程：intent=schedule_add，从话语里提取日程事件填入scheduleEvents
7. 查询日程：intent=schedule_query
8. 命名物品：用户说"把它命名为XX""刚贴的这个贴纸叫XX""这个叫XX"时，识别为name_item意图，表示给最近新录入/刚存入的物品改名；itemName填要改的名字
9. 删除/取消日程：intent=schedule_delete，用户说"取消/删除XX"时，deleteKeyword填要取消的日程关键词；如果用户说了具体日期（如"后天的"），targetDate填YYYY-MM-DD，没说就留空
10. 闲聊时保持可爱、有亲和力
10. 回答简洁，不超过3句话
11. 用emoji增加活泼感，但不要太多

输出必须是严格的JSON格式，结构如下：
{
  "reply": "给用户看的回复文本",
  "intent": "find_items | register_item | name_item | daily_items | chat | schedule_add | schedule_query | schedule_delete",
  "matchedItems": [
    {"name": "物品库中的精确物品名", "reason": "一句理由或状态说明，包含房间位置"}
  ],
  "registerItemName": "要登记的物品名称（仅登记意图时填）",
  "itemName": "要给物品改的名字（仅name_item意图时填）",
  "deleteKeyword": "要取消的日程关键词（仅schedule_delete意图时填）",
  "targetDate": "要取消的日程日期YYYY-MM-DD（仅schedule_delete且用户指定日期时填）",
  "scheduleEvents": [
    {
      "title": "事件标题",
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "location": "地点，提取不到就留空字符串",
      "tag": "work | travel | life | other"
    }
  ]
}

重要规则：
- matchedItems中的name必须是物品库里的精确名称，不能编造
- 查物品/找物品：intent=find_items，matchedItems放所有匹配到的物品
- 今日带什么/推荐：intent=daily_items，matchedItems放推荐物品及理由
- 登记新物品：intent=register_item，registerItemName填物品名
- 命名已有物品：intent=name_item，itemName填新名字（用户说"把它命名为/这个叫XX/刚贴的贴纸叫XX"时）
- 添加日程：intent=schedule_add，scheduleEvents填所有提取到的事件
- 查询日程：intent=schedule_query，scheduleEvents留空
- 删除日程：intent=schedule_delete，deleteKeyword填要取消的日程关键词，指定了日期就填targetDate
- 普通闲聊：intent=chat，matchedItems为空，scheduleEvents为空
- 物品库中找不到就老实说找不到，不要编造
- reply字段要口语化、可爱，直接给用户看`;
  }

  async chat(req: AIChatRequest): Promise<AIChatResponse> {
    try {
      const today = this.getShanghaiToday();
      const userId = req.userId || 'ai_default';
      const { items: allItems } = await this.itemsService.findAllRaw(100);
      const bs = this.settingsService.getBaseStationRaw();
      const tempCarryFromHistory = this.extractTempCarryItems(req.history);
      const initialTempCarry = [...(req.temporaryCarryItems ?? []), ...tempCarryFromHistory];
      const tempCarrySet = Array.from(new Set(initialTempCarry));
      const { text: weather, temp: weatherTemp } = await this.fetchWeather();
      const schedules = await this.getTodaySchedules();
      const quick = this.tryQuickReply(req.message, allItems, bs, tempCarrySet);
    if (quick) {
      const quickWeather = quick as AIChatResponse & { _weatherQuery?: boolean };
      if (quickWeather._weatherQuery) {
        const desc = weather.split('，')[0] || '多云';
        let feeling = '';
        if (weatherTemp <= 5) feeling = '挺冷的，注意保暖哦～';
        else if (weatherTemp <= 15) feeling = '有点凉，记得加件外套～';
        else if (weatherTemp <= 25) feeling = '温度舒适，挺舒服的～';
        else if (weatherTemp <= 32) feeling = '有点热，注意防晒哦～';
        else feeling = '天气炎热，注意防暑降温～';
        quickWeather.reply = `今天西安${desc}，${Math.round(weatherTemp)}°C，${feeling}`;
        quickWeather.intent = 'chat';
      }

      if (quick.intent === 'name_item' && quick.namedItem) {
        try {
          const unnamedStored = allItems
            .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
            .sort((a: ItemLite, b: ItemLite) =>
              new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
            );
          const target = unnamedStored[0];
          if (target) {
            const named = await this.itemsService.update(target.id, {
              name: quick.namedItem.name,
            });
            quick.namedItem = {
              id: named.id,
              name: named.name,
              isStored: named.isStored,
              location: named.location,
            };
          } else {
            quick.reply = '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！';
            quick.intent = 'chat';
            quick.namedItem = undefined;
          }
        } catch (nameErr) {
          const msg = nameErr instanceof Error ? nameErr.message : String(nameErr);
          quick.reply = `命名失败了：${msg}`;
          quick.intent = 'chat';
          quick.namedItem = undefined;
        }
      }

      if (quick.intent === 'schedule_query') {
        const quickWithDate = quick as AIChatResponse & { _queryDate?: string };
        const targetDate = quickWithDate._queryDate || today;
        const { items } = await this.schedulesService.findAll(targetDate);
        const dateLabel = targetDate === today ? '今天' : targetDate;
        if (items.length === 0) {
          quick.reply = `${dateLabel}暂时没有安排哦～`;
        } else {
          const list = items
            .map((s: Schedule) => `${s.startTime}-${s.endTime} ${s.title}`)
            .join('、');
          quick.reply = `${dateLabel}有 ${items.length} 个安排：${list}`;
        }
        quick.scheduleEvents = items.map((s: Schedule) => ({
          title: s.title,
          date: s.scheduleDate,
          startTime: s.startTime,
          endTime: s.endTime,
          location: s.location ?? '',
          tag: s.tag as ScheduleTag,
        }));
      }

      if (quick.intent === 'schedule_add' && quick.scheduleEvents && quick.scheduleEvents.length > 0) {
        const validTags: ScheduleTag[] = ['work', 'travel', 'life', 'other'];
        const createdSchedules: Array<{ id: string; title: string; date: string; startTime: string }> = [];
        for (const ev of quick.scheduleEvents) {
          try {
            const tagVal = ev.tag;
            const validTag: ScheduleTag =
              validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
            const s = await this.schedulesService.create({
              title: ev.title,
              scheduleDate: ev.date,
              startTime: ev.startTime || '09:00',
              endTime: ev.endTime || '10:00',
              location: ev.location || undefined,
              tag: validTag,
            }, userId);
            createdSchedules.push({
              id: s.id,
              title: s.title,
              date: s.scheduleDate,
              startTime: s.startTime,
            });
          } catch (schedErr) {
            const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
            this.logger.warn(`添加日程失败 [${ev.title}]: ${msg}`);
          }
        }
        if (createdSchedules.length > 0) {
          const first = createdSchedules[0];
          const dateLabel = first.date === today ? '今天' : first.date;
          quick.reply = `好的，已添加：${first.title} ${dateLabel} ${first.startTime} 📅`;
          if (createdSchedules.length > 1) {
            quick.reply = `好的，已添加 ${createdSchedules.length} 个日程 📅`;
          }
        }
        quick.temporaryCarryItems = tempCarrySet;
        return quick;
      }

      const quickWithCarry = quick as AIChatResponse & { _carryItem?: string };
      let activeTempCarry = tempCarrySet;
      if (quickWithCarry.intent === 'carry_remind' && quickWithCarry._carryItem) {
        const merged = Array.from(new Set([...tempCarrySet, quickWithCarry._carryItem]));
        quick.temporaryCarryItems = merged;
        activeTempCarry = merged;
      } else {
        quick.temporaryCarryItems = tempCarrySet;
      }
      if (quick.intent === 'daily_items') {
        const rec = this.buildDailyRecommend(allItems, bs, schedules, weather, activeTempCarry);
        if (rec.items.length === 0) {
          quick.reply = '物品库里目前没有相关物品哦，先去添加几个吧～';
          quick.matchedItems = [];
          quick.matchedItem = undefined;
        } else {
          const matchedItems = rec.items.map((it) => ({
            id: it.id,
            name: it.name,
            reason: it.reason,
            isStored: it.isStored,
            signalStrength: it.signalStrength,
            location: it.location,
          }));
          const replyLines: string[] = [`${rec.sceneLabel}出门必带清单👇`];
          for (const r of rec.items) {
            if (r.isStored && r.inLibrary) {
              replyLines.push(`· ${r.name}在${r.location}，记得去拿`);
            } else if (!r.inLibrary) {
              replyLines.push(`· ${r.name}（记得带上哦）`);
            } else {
              replyLines.push(`· ${r.name}（已经带着了）`);
            }
          }
          quick.reply = replyLines.join('\n');
          quick.matchedItems = matchedItems;
          quick.matchedItem = matchedItems[0]
            ? { id: matchedItems[0].id, name: matchedItems[0].name, isStored: matchedItems[0].isStored, location: matchedItems[0].location }
            : undefined;
        }
      }
      return quick;
    }

    const namedItems = allItems.filter((it: ItemLite) => it.name && it.name.trim().length > 0);

    const upcoming = await this.getUpcomingSchedules(3);
    const itemsText = namedItems.length > 0
      ? namedItems
          .map((it: ItemLite) => {
            const room = inferRoom(it.isStored, it.signalStrength, bs.location, bs.threshold);
            return `- ${it.name}（编号：${it.id}，位置：${room}，信号：${it.signalStrength}%）`;
          })
          .join('\n')
      : '（暂无已登记的物品，所有贴纸都还在待录入状态）';

    const contextBlock = this.buildContextBlock(weather, schedules, upcoming);
    const systemPrompt = this.buildSystemPrompt(itemsText, contextBlock, today);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (req.history?.length) {
      for (const h of req.history.slice(-10)) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: req.message });

    const cfg = this.settingsService.getModelConfigRaw();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.modelName,
          messages,
          temperature: 0.8,
          max_tokens: 800,
          stream: false,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`大模型 API 错误 [${response.status}]: ${errText.slice(0, 300)}`);
        throw new BadRequestException(
          `小寻暂时无法响应（HTTP ${response.status}），请稍后重试`,
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      let parsed: {
        reply?: string;
        intent?: string;
        matchedItems?: Array<{ name: string; reason: string }>;
        registerItemName?: string;
        itemName?: string;
        scheduleEvents?: Array<{
          title: string;
          date: string;
          startTime: string;
          endTime: string;
          location: string;
          tag: string;
        }>;
        deleteKeyword?: string;
        targetDate?: string;
      };
      try {
        parsed = JSON.parse(content) as typeof parsed;
      } catch {
        this.logger.warn('大模型返回非 JSON，降级处理');
        return this.fallbackChatReply(req.message, allItems, this.settingsService.getBaseStationRaw());
      }

      const reply = parsed.reply ?? '嗯...我想想～';
      const intent = (parsed.intent as AIChatResponse['intent']) ?? 'chat';

      const matchedNameSet = new Set<string>();
      const matchableItems = allItems.filter(
        (it: ItemLite) => it.name && it.name.trim().length > 0,
      );
      const matchedItems: AIChatResponse['matchedItems'] = (parsed.matchedItems ?? [])
        .map((rec: { name: string; reason: string }) => {
          const found = matchableItems.find(
            (it: ItemLite) =>
              it.name === rec.name ||
              rec.name.includes(it.name) ||
              it.name.includes(rec.name),
          );
          if (found && matchedNameSet.has(found.name)) {
            return null;
          }
          if (found) {
            matchedNameSet.add(found.name);
          }
          return found
            ? {
                id: found.id,
                name: found.name,
                reason: rec.reason,
                isStored: found.isStored,
                signalStrength: found.signalStrength,
                location: found.location,
              }
            : null;
        })
        .filter(
          (it): it is NonNullable<typeof it> => it !== null,
        );

      const firstMatch = matchedItems[0];

      const result: AIChatResponse = {
        reply,
        intent,
        matchedItems,
      };
      if (firstMatch) {
        result.matchedItem = {
          id: firstMatch.id,
          name: firstMatch.name,
          isStored: firstMatch.isStored,
          location: firstMatch.location,
        };
      }
      if (intent === 'register_item' && parsed.registerItemName) {
        result.registerItemName = parsed.registerItemName;
      }

      if (intent === 'name_item' && parsed.itemName) {
        const unnamedStored = allItems
          .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
          .sort((a: ItemLite, b: ItemLite) =>
            new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
          );
        const target = unnamedStored[0];
        if (target) {
          try {
            const named = await this.itemsService.update(target.id, {
              name: parsed.itemName,
            });
            result.namedItem = {
              id: named.id,
              name: named.name,
              isStored: named.isStored,
              location: named.location,
            };
            result.reply = `好的，已命名为：${parsed.itemName} ✨`;
          } catch (nameErr) {
            const msg = nameErr instanceof Error ? nameErr.message : String(nameErr);
            result.reply = `命名失败了：${msg}`;
            result.intent = 'chat';
          }
        } else {
          result.reply = '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！';
          result.intent = 'chat';
        }
      }

      if (intent === 'schedule_add' && parsed.scheduleEvents && parsed.scheduleEvents.length > 0) {
        const validTags: ScheduleTag[] = ['work', 'travel', 'life', 'other'];
        const createdSchedules: Array<{ id: string; title: string; date: string; startTime: string }> = [];
        for (const ev of parsed.scheduleEvents) {
          try {
            const tagVal = ev.tag;
            const validTag: ScheduleTag =
              validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
            const s = await this.schedulesService.create({
              title: ev.title,
              scheduleDate: ev.date,
              startTime: ev.startTime || '09:00',
              endTime: ev.endTime || '10:00',
              location: ev.location || undefined,
              tag: validTag,
            }, userId);
            createdSchedules.push({
              id: s.id,
              title: s.title,
              date: s.scheduleDate,
              startTime: s.startTime,
            });
          } catch (schedErr) {
            const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
            this.logger.warn(`添加日程失败 [${ev.title}]: ${msg}`);
          }
        }
        if (createdSchedules.length > 0) {
          const first = createdSchedules[0];
          const dateLabel = first.date === today ? '今天' : first.date;
          result.reply = `好的，已添加：${first.title} ${dateLabel} ${first.startTime} 📅`;
          if (createdSchedules.length > 1) {
            result.reply = `好的，已添加 ${createdSchedules.length} 个日程 📅`;
          }
        }
        result.scheduleEvents = parsed.scheduleEvents.map((ev) => {
          const tagVal = ev.tag;
          const validTag: ScheduleTag =
            validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
          return {
            title: ev.title,
            date: ev.date,
            startTime: ev.startTime || '09:00',
            endTime: ev.endTime || '10:00',
            location: ev.location || '',
            tag: validTag,
          };
        });
      }

      if (intent === 'schedule_delete' && parsed.deleteKeyword) {
        const keyword = parsed.deleteKeyword.trim();
        const { items: allSchedules } = await this.schedulesService.findAll();
        const candidates = allSchedules.filter((s: Schedule) => {
          if (!keyword) return false;
          return s.title.includes(keyword) || keyword.includes(s.title);
        });
        if (parsed.targetDate) {
          const dateFiltered = candidates.filter(
            (s: Schedule) => s.scheduleDate === parsed.targetDate,
          );
          candidates.length = 0;
          for (const s of dateFiltered) candidates.push(s);
        }
        const toDelete = candidates.slice(0, 3);
        const deleted: Array<{ id: string; title: string; date: string; startTime: string }> = [];
        for (const s of toDelete) {
          try {
            await this.schedulesService.remove(s.id);
            deleted.push({
              id: s.id,
              title: s.title,
              date: s.scheduleDate,
              startTime: s.startTime,
            });
          } catch (delErr) {
            this.logger.warn('删除日程失败', s.id);
          }
        }
        if (deleted.length > 0) {
          result.reply = `好的，已取消：${deleted.map((d: { title: string }) => d.title).join('、')} ✅`;
          result.deletedSchedules = deleted;
        } else {
          result.reply = '没找到对应的日程呢，告诉我更多细节好不好？';
          result.intent = 'chat';
        }
      }

      if (intent === 'schedule_query') {
        const targetDate = parsed.scheduleEvents?.[0]?.date || today;
        const { items } = await this.schedulesService.findAll(targetDate);
        const dateLabel = targetDate === today ? '今天' : targetDate;
        if (items.length === 0) {
          result.reply = `${dateLabel}暂时没有安排哦～`;
        } else {
          const list = items
            .map((s: Schedule) => `${s.startTime}-${s.endTime} ${s.title}`)
            .join('、');
          result.reply = `${dateLabel}有 ${items.length} 个安排：${list}`;
        }
        result.scheduleEvents = items.map((s: Schedule) => ({
          title: s.title,
          date: s.scheduleDate,
          startTime: s.startTime,
          endTime: s.endTime,
          location: s.location ?? '',
          tag: s.tag as ScheduleTag,
        }));
      }

      result.temporaryCarryItems = tempCarrySet;
      return result;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.error(`AI 对话失败${isTimeout ? '（超时）' : ''}`, msg);
      throw new BadRequestException(
        isTimeout
          ? '小寻响应超时了，请重试一下～'
          : `小寻暂时没响应：${msg.slice(0, 60)}`,
      );
    }
  }

  async *chatStream(req: AIChatRequest): AsyncGenerator<
    { type: 'delta'; content: string } | { type: 'done'; data: AIChatResponse },
    void,
    unknown
  > {
    const today = this.getShanghaiToday();
    const userId = req.userId || 'ai_default';
    const { items: allItems } = await this.itemsService.findAllRaw(100);
    const bs = this.settingsService.getBaseStationRaw();
    const tempCarryFromHistory = this.extractTempCarryItems(req.history);
    const initialTempCarry = [...(req.temporaryCarryItems ?? []), ...tempCarryFromHistory];
    const tempCarrySet = Array.from(new Set(initialTempCarry));
    const { text: weather, temp: weatherTemp } = await this.fetchWeather();
    const schedules = await this.getTodaySchedules();
    const quick = this.tryQuickReply(req.message, allItems, bs, tempCarrySet);
    if (quick) {
      const quickWeather = quick as AIChatResponse & { _weatherQuery?: boolean };
      if (quickWeather._weatherQuery) {
        const desc = weather.split('，')[0] || '多云';
        let feeling = '';
        if (weatherTemp <= 5) feeling = '挺冷的，注意保暖哦～';
        else if (weatherTemp <= 15) feeling = '有点凉，记得加件外套～';
        else if (weatherTemp <= 25) feeling = '温度舒适，挺舒服的～';
        else if (weatherTemp <= 32) feeling = '有点热，注意防晒哦～';
        else feeling = '天气炎热，注意防暑降温～';
        quickWeather.reply = `今天西安${desc}，${Math.round(weatherTemp)}°C，${feeling}`;
        quickWeather.intent = 'chat';
        yield { type: 'delta', content: quickWeather.reply };
        yield { type: 'done', data: quickWeather };
        return;
      }

      if (quick.intent === 'name_item' && quick.namedItem) {
        try {
          const unnamedStored = allItems
            .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
            .sort((a: ItemLite, b: ItemLite) =>
              new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
            );
          const target = unnamedStored[0];
          if (target) {
            const named = await this.itemsService.update(target.id, {
              name: quick.namedItem.name,
            });
            quick.namedItem = {
              id: named.id,
              name: named.name,
              isStored: named.isStored,
              location: named.location,
            };
          } else {
            quick.reply = '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！';
            quick.intent = 'chat';
            quick.namedItem = undefined;
          }
        } catch (nameErr) {
          const msg = nameErr instanceof Error ? nameErr.message : String(nameErr);
          quick.reply = `命名失败了：${msg}`;
          quick.intent = 'chat';
          quick.namedItem = undefined;
        }
      }

      if (quick.intent === 'schedule_add' && quick.scheduleEvents && quick.scheduleEvents.length > 0) {
        const validTags: ScheduleTag[] = ['work', 'travel', 'life', 'other'];
        const createdSchedules: Array<{ id: string; title: string; date: string; startTime: string }> = [];
        for (const ev of quick.scheduleEvents) {
          try {
            const tagVal = ev.tag;
            const validTag: ScheduleTag =
              validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
            const s = await this.schedulesService.create({
              title: ev.title,
              scheduleDate: ev.date,
              startTime: ev.startTime || '09:00',
              endTime: ev.endTime || '10:00',
              location: ev.location || undefined,
              tag: validTag,
            }, userId);
            createdSchedules.push({
              id: s.id,
              title: s.title,
              date: s.scheduleDate,
              startTime: s.startTime,
            });
          } catch (schedErr) {
            const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
            this.logger.warn(`添加日程失败 [${ev.title}]: ${msg}`);
          }
        }
        if (createdSchedules.length > 0) {
          const first = createdSchedules[0];
          const dateLabel = first.date === today ? '今天' : first.date;
          quick.reply = `好的，已添加：${first.title} ${dateLabel} ${first.startTime} 📅`;
          if (createdSchedules.length > 1) {
            quick.reply = `好的，已添加 ${createdSchedules.length} 个日程 📅`;
          }
        }
        yield { type: 'delta', content: quick.reply };
        quick.temporaryCarryItems = tempCarrySet;
        yield { type: 'done', data: quick };
        return;
      }

      const text = quick.reply;
      let i = 0;
      while (i < text.length) {
        const step = Math.min(2, text.length - i);
        yield { type: 'delta', content: text.slice(i, i + step) };
        i += step;
      }
      const quickWithCarry = quick as AIChatResponse & { _carryItem?: string };
      let activeTempCarry = tempCarrySet;
      if (quickWithCarry.intent === 'carry_remind' && quickWithCarry._carryItem) {
        const merged = Array.from(new Set([...tempCarrySet, quickWithCarry._carryItem]));
        quick.temporaryCarryItems = merged;
        activeTempCarry = merged;
      } else {
        quick.temporaryCarryItems = tempCarrySet;
      }
      if (quick.intent === 'daily_items') {
        const rec = this.buildDailyRecommend(allItems, bs, schedules, weather, activeTempCarry);
        if (rec.items.length === 0) {
          quick.reply = '物品库里目前没有相关物品哦，先去添加几个吧～';
          quick.matchedItems = [];
          quick.matchedItem = undefined;
        } else {
          const matchedItems = rec.items.map((it) => ({
            id: it.id,
            name: it.name,
            reason: it.reason,
            isStored: it.isStored,
            signalStrength: it.signalStrength,
            location: it.location,
          }));
          const replyLines: string[] = [`${rec.sceneLabel}出门必带清单👇`];
          for (const r of rec.items) {
            if (r.isStored && r.inLibrary) {
              replyLines.push(`· ${r.name}在${r.location}，记得去拿`);
            } else if (!r.inLibrary) {
              replyLines.push(`· ${r.name}（记得带上哦）`);
            } else {
              replyLines.push(`· ${r.name}（已经带着了）`);
            }
          }
          quick.reply = replyLines.join('\n');
          quick.matchedItems = matchedItems;
          quick.matchedItem = matchedItems[0]
            ? { id: matchedItems[0].id, name: matchedItems[0].name, isStored: matchedItems[0].isStored, location: matchedItems[0].location }
            : undefined;
        }
      }
      yield { type: 'done', data: quick };
      return;
    }

    const namedItems = allItems.filter((it: ItemLite) => it.name && it.name.trim().length > 0);

    const upcoming = await this.getUpcomingSchedules(3);
    const itemsText = namedItems.length > 0
      ? namedItems
          .map((it: ItemLite) => {
            const room = inferRoom(it.isStored, it.signalStrength, bs.location, bs.threshold);
            return `- ${it.name}（编号：${it.id}，位置：${room}，信号：${it.signalStrength}%）`;
          })
          .join('\n')
      : '（暂无已登记的物品，所有贴纸都还在待录入状态）';

    const contextBlock = this.buildContextBlock(weather, schedules, upcoming);
    const systemPrompt = this.buildSystemPrompt(itemsText, contextBlock, today);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (req.history?.length) {
      for (const h of req.history.slice(-10)) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: req.message });

    const cfg = this.settingsService.getModelConfigRaw();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: cfg.modelName,
          messages,
          temperature: 0.8,
          max_tokens: 800,
          stream: true,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`流式 AI 对话失败${isTimeout ? '（超时）' : ''}`, msg);
      throw new BadRequestException(
        isTimeout
          ? '小寻响应超时了，请重试一下～'
          : `小寻暂时没响应：${msg.slice(0, 60)}`,
      );
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`流式大模型 API 错误 [${response.status}]: ${errText.slice(0, 300)}`);
      throw new BadRequestException(
        `小寻暂时无法响应（HTTP ${response.status}），请稍后重试`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new BadRequestException('小寻暂时无法响应（无响应流），请稍后重试');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(dataStr) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string;
              }>;
            };
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullContent += delta;
              yield { type: 'delta', content: delta };
            }
          } catch {
            // 忽略解析失败的单个 chunk
          }
        }
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`流式读取中断${isTimeout ? '（超时）' : ''}`, msg);
      throw new BadRequestException(
        isTimeout ? '小寻响应超时了，请重试一下～' : '小寻响应中断了，请重试',
      );
    } finally {
      reader.releaseLock();
    }

    let parsed: {
      reply?: string;
      intent?: string;
      matchedItems?: Array<{ name: string; reason: string }>;
      registerItemName?: string;
      itemName?: string;
      scheduleEvents?: Array<{
        title: string;
        date: string;
        startTime: string;
        endTime: string;
        location: string;
        tag: string;
      }>;
      deleteKeyword?: string;
      targetDate?: string;
    };
    try {
      parsed = JSON.parse(fullContent || '{}') as typeof parsed;
    } catch {
      this.logger.warn('流式返回非 JSON，用纯文本兜底');
      const fallback = this.fallbackChatReply(req.message, allItems, this.settingsService.getBaseStationRaw());
      yield {
        type: 'done',
        data: fallback,
      };
      return;
    }

    const reply = parsed.reply ?? '嗯...我想想～';
    const intent = (parsed.intent as AIChatResponse['intent']) ?? 'chat';

    const matchedNameSet = new Set<string>();
    const matchableItems = allItems.filter(
      (it: ItemLite) => it.name && it.name.trim().length > 0,
    );
    const matchedItems: AIChatResponse['matchedItems'] = (parsed.matchedItems ?? [])
      .map((rec: { name: string; reason: string }) => {
        const found = matchableItems.find(
          (it: ItemLite) =>
            it.name === rec.name ||
            rec.name.includes(it.name) ||
            it.name.includes(rec.name),
        );
        if (found && matchedNameSet.has(found.name)) return null;
        if (found) matchedNameSet.add(found.name);
        return found
          ? {
              id: found.id,
              name: found.name,
              reason: rec.reason,
              isStored: found.isStored,
              signalStrength: found.signalStrength,
              location: found.location,
            }
          : null;
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);

    const firstMatch = matchedItems[0];
     const result: AIChatResponse = { reply, intent, matchedItems };
    if (firstMatch) {
      result.matchedItem = {
        id: firstMatch.id,
        name: firstMatch.name,
        isStored: firstMatch.isStored,
        location: firstMatch.location,
      };
    }
    if (intent === 'register_item' && parsed.registerItemName) {
      result.registerItemName = parsed.registerItemName;
    }
    if (intent === 'name_item' && parsed.itemName) {
      const unnamedStored = allItems
        .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
        .sort((a: ItemLite, b: ItemLite) =>
          new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
        );
      const target = unnamedStored[0];
      if (target) {
        try {
          const named = await this.itemsService.update(target.id, {
            name: parsed.itemName,
          });
          result.namedItem = {
            id: named.id,
            name: named.name,
            isStored: named.isStored,
            location: named.location,
          };
          result.reply = `好的，已命名为：${parsed.itemName} ✨`;
        } catch (nameErr) {
          const msg = nameErr instanceof Error ? nameErr.message : String(nameErr);
          result.reply = `命名失败了：${msg}`;
          result.intent = 'chat';
        }
      } else {
        result.reply = '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！';
        result.intent = 'chat';
      }
    }
    if (intent === 'schedule_add' && parsed.scheduleEvents && parsed.scheduleEvents.length > 0) {
      const validTags: ScheduleTag[] = ['work', 'travel', 'life', 'other'];
      const createdSchedules: Array<{ id: string; title: string; date: string; startTime: string }> = [];
      for (const ev of parsed.scheduleEvents) {
        try {
          const tagVal = ev.tag;
          const validTag: ScheduleTag =
            validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
          const s = await this.schedulesService.create({
            title: ev.title,
            scheduleDate: ev.date,
            startTime: ev.startTime || '09:00',
            endTime: ev.endTime || '10:00',
            location: ev.location || undefined,
            tag: validTag,
          }, userId);
          createdSchedules.push({
            id: s.id,
            title: s.title,
            date: s.scheduleDate,
            startTime: s.startTime,
          });
        } catch (schedErr) {
          const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
          this.logger.warn(`添加日程失败 [${ev.title}]: ${msg}`);
        }
      }
      if (createdSchedules.length > 0) {
        const first = createdSchedules[0];
        const dateLabel = first.date === today ? '今天' : first.date;
        result.reply = `好的，已添加：${first.title} ${dateLabel} ${first.startTime} 📅`;
        if (createdSchedules.length > 1) {
          result.reply = `好的，已添加 ${createdSchedules.length} 个日程 📅`;
        }
      }
      result.scheduleEvents = parsed.scheduleEvents.map((ev) => {
        const tagVal = ev.tag;
        const validTag: ScheduleTag =
          validTags.includes(tagVal as ScheduleTag) ? (tagVal as ScheduleTag) : 'work';
        return {
          title: ev.title,
          date: ev.date,
          startTime: ev.startTime || '09:00',
          endTime: ev.endTime || '10:00',
          location: ev.location || '',
          tag: validTag,
        };
      });
    }

    if (intent === 'schedule_delete' && parsed.deleteKeyword) {
      const keyword = parsed.deleteKeyword.trim();
      const { items: allSchedules } = await this.schedulesService.findAll();
      const candidates = allSchedules.filter((s: Schedule) => {
        if (!keyword) return false;
        return s.title.includes(keyword) || keyword.includes(s.title);
      });
      if (parsed.targetDate) {
        const dateFiltered = candidates.filter(
          (s: Schedule) => s.scheduleDate === parsed.targetDate,
        );
        candidates.length = 0;
        for (const s of dateFiltered) candidates.push(s);
      }
      const toDelete = candidates.slice(0, 3);
      const deleted: Array<{ id: string; title: string; date: string; startTime: string }> = [];
      for (const s of toDelete) {
        try {
          await this.schedulesService.remove(s.id);
          deleted.push({
            id: s.id,
            title: s.title,
            date: s.scheduleDate,
            startTime: s.startTime,
          });
        } catch (delErr) {
          this.logger.warn('删除日程失败', s.id);
        }
      }
      if (deleted.length > 0) {
        result.reply = `好的，已取消：${deleted.map((d: { title: string }) => d.title).join('、')} ✅`;
        result.deletedSchedules = deleted;
      } else {
        result.reply = '没找到对应的日程呢，告诉我更多细节好不好？';
        result.intent = 'chat';
      }
    }

    if (intent === 'schedule_query') {
      const targetDate = parsed.scheduleEvents?.[0]?.date || today;
      const { items } = await this.schedulesService.findAll(targetDate);
      const dateLabel = targetDate === today ? '今天' : targetDate;
      if (items.length === 0) {
        result.reply = `${dateLabel}暂时没有安排哦～`;
      } else {
        const list = items
          .map((s: Schedule) => `${s.startTime}-${s.endTime} ${s.title}`)
          .join('、');
        result.reply = `${dateLabel}有 ${items.length} 个安排：${list}`;
      }
      result.scheduleEvents = items.map((s: Schedule) => ({
        title: s.title,
        date: s.scheduleDate,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location ?? '',
        tag: s.tag as ScheduleTag,
      }));
    }

    result.temporaryCarryItems = tempCarrySet;
    yield { type: 'done', data: result };
  }

  private buildDailyRecommend(
    allItems: ItemLite[],
    bs: { location: string; locationCode: string; threshold: number },
    schedules: Schedule[],
    weather: string,
    temporaryCarryItems: string[],
  ): {
    items: Array<{ id: string; name: string; reason: string; isStored: boolean; signalStrength: number; location: string; inLibrary: boolean }>;
    sceneLabel: string;
  } {
    const namedItems = allItems.filter(
      (it: ItemLite) => it.name && it.name.trim().length > 0,
    );

    let sceneLabel = '日常';
    const sceneScorers: Array<{ pattern: RegExp; keywords: string[]; label: string }> = [
      { pattern: /博物馆|美术馆|展览|展会|科技馆|纪念馆|景区|景点|旅游|旅行|游玩|逛/, keywords: ['身份证', '手机', '充电宝', '耳机', '水杯', '相机', '门票'], label: '外出游玩' },
      { pattern: /出差|坐飞机|高铁|火车|航班|机场|外地/, keywords: ['身份证', '充电器', '充电宝', '耳机', '行李箱', '电脑'], label: '出差旅行' },
      { pattern: /上班|公司|开会|工位|打卡/, keywords: ['工牌', '钥匙', '手机', '耳机', '笔记本', '电脑'], label: '上班' },
      { pattern: /上学|学校|上课|考试/, keywords: ['书包', '书本', '笔袋', '水杯', '课本'], label: '上学' },
      { pattern: /健身|运动|跑步|打球|游泳|瑜伽/, keywords: ['水杯', '毛巾', '耳机', '运动鞋', '运动服'], label: '运动健身' },
      { pattern: /医院|看病|体检|就医/, keywords: ['身份证', '医保卡', '手机', '病历'], label: '就医' },
      { pattern: /聚餐|吃饭|约会|看电影|电影/, keywords: ['手机', '充电宝', '耳机', '钥匙'], label: '休闲聚会' },
    ];

    const scheduleText = schedules.map((s: Schedule) => s.title).join('');
    let sceneKeywords: string[] = [];
    for (const sk of sceneScorers) {
      if (sk.pattern.test(scheduleText)) {
        sceneLabel = sk.label;
        sceneKeywords = sk.keywords;
        break;
      }
    }

    let weatherKeywords: string[] = [];
    if (/雨|下雨|阵雨|雷阵雨/.test(weather)) weatherKeywords.push('雨伞', '雨衣');
    if (/冷|降温|低温|寒/.test(weather)) weatherKeywords.push('外套', '围巾', '手套');
    if (/晴|晒|太阳|高温/.test(weather)) weatherKeywords.push('防晒霜', '帽子', '墨镜');

    const keywordScore = (name: string, kws: string[]): number => {
      for (const kw of kws) {
        if (name === kw || name.includes(kw) || kw.includes(name)) return 1;
      }
      return 0;
    };

    const scored = namedItems
      .map((it: ItemLite) => {
        const name = it.name || '';
        let score = 0;
        let reason = '日常出门';
        const sceneHit = keywordScore(name, sceneKeywords);
        const weatherHit = keywordScore(name, weatherKeywords);
        if (sceneHit > 0) { score += 10; reason = `${sceneLabel}相关`; }
        if (weatherHit > 0) { score += 5; reason = weatherHit > 0 && sceneHit > 0 ? `${sceneLabel} + 天气相关` : '天气相关'; }
        return { item: it, score, reason };
      })
      .sort((a: { item: ItemLite; score: number }, b: { item: ItemLite; score: number }) =>
        b.score - a.score || b.item.signalStrength - a.item.signalStrength,
      );

    const result: Array<{ id: string; name: string; reason: string; isStored: boolean; signalStrength: number; location: string; inLibrary: boolean }> = [];
    const seenNames = new Set<string>();
    for (const { item, reason } of scored) {
      const name = item.name || '';
      if (seenNames.has(name)) continue;
      if (result.length >= 6) break;
      seenNames.add(name);
      const room = inferRoom(item.isStored, item.signalStrength, bs.location, bs.threshold);
      let finalReason = reason;
      if (item.isStored) finalReason += `，在${room}记得去拿`;
      else finalReason += '（已经带着了）';
      result.push({
        id: item.id,
        name,
        reason: finalReason,
        isStored: item.isStored,
        signalStrength: item.signalStrength,
        location: room,
        inLibrary: true,
      });
    }

    for (const name of temporaryCarryItems) {
      result.push({
        id: `temp_${name}`,
        name,
        reason: '你说要记得带的，别忘了',
        isStored: false,
        signalStrength: 0,
        location: '',
        inLibrary: false,
      });
    }

    return { items: result, sceneLabel };
  }

  private extractTempCarryItems(
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): string[] {
    if (!history || history.length === 0) return [];
    const items: string[] = [];
    const carryPattern = /(?:提醒我带|记得带|别忘了带|别忘记带|出门要带|等会.*?带|一会.*?带)([^，。！？、\s]{1,30})/g;
    for (const h of history) {
      if (h.role !== 'user') continue;
      let match: RegExpExecArray | null;
      while ((match = carryPattern.exec(h.content)) !== null) {
        const name = match[1].trim();
        if (name && !items.includes(name)) items.push(name);
      }
    }
    return items;
  }

  private tryQuickReply(
    message: string,
    allItems: ItemLite[],
    bs: { location: string; locationCode: string; threshold: number },
    temporaryCarryItems: string[] = [],
  ): AIChatResponse | null {
    const trimmed = message.trim();

    if (/你好|嗨|hi|hello|在吗/i.test(trimmed)) {
      return { reply: '你好呀～我是小寻✨ 有什么物品想找吗？', intent: 'chat' };
    }
    if (/你是谁|你叫什么/.test(trimmed)) {
      return {
        reply: '我是小寻呀～一只守护你所有物品的寻物小助手🐰 有什么东西找不到了就告诉我吧！',
        intent: 'chat',
      };
    }
    if (/谢谢|感谢|拜拜|再见/.test(trimmed)) {
      return { reply: '不客气～随时找我玩呀💕', intent: 'chat' };
    }

    const carryMatch = /(?:提醒我带|记得带|别忘了带|别忘记带|出门要带|等会.*?带|一会.*?带)([^，。！？、\s]{1,30})/.exec(trimmed);
    if (carryMatch && carryMatch[1]) {
      const itemName = carryMatch[1].trim();
      if (itemName.length > 0 && itemName.length <= 30) {
        return {
          reply: `好的～出门的时候会提醒你带${itemName}的✨`,
          intent: 'carry_remind',
          matchedItems: [],
          _carryItem: itemName,
        } as unknown as AIChatResponse & { _carryItem: string };
      }
    }

    const nameMatch = /(?:命名为|改名为|改名|叫|这个叫|刚贴的.*?叫|它叫).{0,6}?([^，。！？、\s]{1,20})$/.exec(trimmed);
    if (nameMatch && nameMatch[1]) {
      const newName = nameMatch[1].trim();
      if (newName.length > 0 && newName.length <= 20 && /[^a-zA-Z0-9]/.test(newName)) {
        const unnamedStored = allItems
          .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
          .sort((a: ItemLite, b: ItemLite) =>
            new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
          );
        const target = unnamedStored[0];
        if (target) {
          return {
            reply: `好的，已命名为：${newName} ✨`,
            intent: 'name_item',
            matchedItems: [],
            namedItem: {
              id: target.id,
              name: newName,
              isStored: target.isStored,
              location: target.location,
            },
            registerItemName: newName,
          };
        }
        return {
          reply: '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！',
          intent: 'chat',
        };
      }
    }

    const itemKeywords = ['钥匙', '钱包', '眼镜', '手机', '耳机', '雨伞', '水杯', '门禁', '工牌', '身份证', '护照', '充电器', '充电宝', '眼镜盒', '笔记本', '书本', '文件', '公文包', '书包', '手套', '围巾', '帽子'];
    let findKeyword = '';
    for (const kw of itemKeywords) {
      if (trimmed.includes(kw)) { findKeyword = kw; break; }
    }
    if (!findKeyword && /找|我的/.test(trimmed)) {
      findKeyword = 'find_generic';
    }
    if (findKeyword && findKeyword !== 'find_generic') {
      const named = allItems.filter((it: ItemLite) => it.name && it.name.trim().length > 0);
      const found = named.find((it: ItemLite) => it.name.includes(findKeyword));
      if (found) {
        if (!found.isStored) {
          return {
            reply: '这个你随身带着呢～不用特意找它。',
            intent: 'find_items',
            matchedItem: { id: found.id, name: found.name, isStored: found.isStored, location: '随身' },
            matchedItems: [
              {
                id: found.id,
                name: found.name,
                reason: '随身带着，不用找',
                isStored: found.isStored,
                signalStrength: found.signalStrength,
                location: '随身',
              },
            ],
          };
        }
        const room = inferRoom(found.isStored, found.signalStrength, bs.location, bs.threshold);
        return {
          reply: `找到了！${found.name}在${room}，信号强度 ${found.signalStrength}%。`,
          intent: 'find_items',
          matchedItem: { id: found.id, name: found.name, isStored: found.isStored, location: room },
          matchedItems: [
            {
              id: found.id,
              name: found.name,
              reason: `在${room}，信号 ${found.signalStrength}%`,
              isStored: found.isStored,
              signalStrength: found.signalStrength,
              location: room,
            },
          ],
        };
      }
      return { reply: '还没登记这个物品哦，可以先去贴个贴纸登记一下～✨', intent: 'chat' };
    }

    if (/登记|录入|这叫|这个叫|这是|这个是/.test(trimmed)) {
      const nameMatch = /(?:登记|录入|这叫|这个叫|这是|这个是)\s*(.+)/.exec(trimmed);
      const name = nameMatch?.[1]?.trim() ?? trimmed;
      return {
        reply: `好的～要把「${name}」登记为新物品对吗？`,
        intent: 'register_item',
        registerItemName: name,
      };
    }

    const weatherPattern = /(?:今天|今日|现在|外面|外边)?(?:天气怎么样|天气如何|什么天气|气温多少|温度多少|冷不冷|热不热|下雨吗|有雨吗|刮风吗|晴天吗|咋样|天气)\??$/;
    if (weatherPattern.test(trimmed) || /^今天.*天气/.test(trimmed) || /天气.*怎么样/.test(trimmed) || /外面.*(冷|热|下雨|晴|风)/.test(trimmed)) {
      return {
        reply: '正在查询天气…',
        intent: 'chat',
        matchedItems: [],
        _weatherQuery: true,
      } as AIChatResponse & { _weatherQuery: boolean };
    }

    const scheduleQueryPattern = /(?:今天|明天|后天|大后天|这周|下周|周[一二三四五六日天]|[0-9]+月[0-9]+号?|[0-9]+\/[0-9]+)?(?:有什么(?:日程|安排|计划)|(?:日程|安排|计划)有什么|(?:日程|安排)是什么|有哪些(?:安排|日程|计划)|查(?:一下|看|询)?(?:日程|安排)|什么(?:日程|安排))/;
    if (scheduleQueryPattern.test(trimmed) || /吗|呢|？|\?/.test(trimmed) && /日程|安排|计划/.test(trimmed)) {
      const dateMatch = /(明天|后天|大后天|周[一二三四五六日天]|[0-9]+月[0-9]+号?|[0-9]+\/[0-9]+)/.exec(trimmed);
      const now = new Date();
      const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      let dayOffset = 0;
      let dateLabel = '今天';
      if (dateMatch) {
        const raw = dateMatch[1];
        if (raw === '明天') { dayOffset = 1; dateLabel = '明天'; }
        else if (raw === '后天') { dayOffset = 2; dateLabel = '后天'; }
        else if (raw === '大后天') { dayOffset = 3; dateLabel = '大后天'; }
      }
      const targetDate = new Date(shanghaiNow.getTime() + dayOffset * 24 * 3600 * 1000);
      const dateStr = targetDate.toISOString().slice(0, 10);
      return {
        reply: `${dateLabel}的日程我来查一下～`,
        intent: 'schedule_query',
        matchedItems: [],
        scheduleEvents: [],
        _queryDate: dateStr,
      } as AIChatResponse & { _queryDate: string };
    }

    if (/今天.*带|出门.*带|必带|推荐|我要出门|我出门了|出门要带|我要出发了|我出发了|出发.*带|今天.*拿|带什么|拿什么/.test(trimmed)) {
      const baseRecs = allItems.slice(0, 3).map((it: ItemLite) => {
        const room = inferRoom(it.isStored, it.signalStrength, bs.location, bs.threshold);
        return {
          id: it.id,
          name: it.name,
          reason: `在${room}，信号 ${it.signalStrength}%`,
          isStored: it.isStored,
          signalStrength: it.signalStrength,
          location: room,
        };
      });
      const tempItems = temporaryCarryItems.filter(
        (name: string) => !baseRecs.some((r) => r.name === name),
      );
      const tempRecs = tempItems.map((name: string) => {
        const found = allItems.find((it: ItemLite) => it.name === name || it.name.includes(name));
        if (found) {
          const room = inferRoom(found.isStored, found.signalStrength, bs.location, bs.threshold);
          return {
            id: found.id,
            name: found.name,
            reason: `你说要记得带的，在${room}`,
            isStored: found.isStored,
            signalStrength: found.signalStrength,
            location: room,
          };
        }
        return {
          id: `temp_${name}`,
          name,
          reason: '你说要记得带的，记得带上哦',
          isStored: false,
          signalStrength: 0,
          location: '',
        };
      });
      const recs = [...baseRecs, ...tempRecs];
      const replyLines: string[] = ['出门必带清单来啦👇'];
      for (const r of recs) {
        if (r.id.startsWith('temp_')) {
          replyLines.push(`· ${r.name}（你说要记得带的，别忘了）`);
        } else if (r.isStored) {
          replyLines.push(`· ${r.name}在${r.location}，记得去拿`);
        } else {
          replyLines.push(`· ${r.name}（已经带着了，不用找）`);
        }
      }
      return {
        reply: replyLines.join('\n'),
        intent: 'daily_items',
        matchedItems: recs,
        matchedItem: recs[0]
          ? { id: recs[0].id, name: recs[0].name, isStored: recs[0].isStored, location: recs[0].location }
          : undefined,
      };
    }

    const scheduleMatch = /^(明天|后天|大后天|周[一二三四五六日天]|[0-9]+月[0-9]+号?|[0-9]+\/[0-9]+).{0,8}(?:要去|要参加|去|参加|安排|约了|会议|约会|上课|上班|出差|旅行|旅游|看)(.+)$/.exec(trimmed);
    if (scheduleMatch && !/吗|呢|？|\?/.test(trimmed)) {
      const dateRaw = scheduleMatch[1];
      const title = scheduleMatch[2].trim();
      const now = new Date();
      const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      let dayOffset = 0;
      if (dateRaw === '明天') dayOffset = 1;
      else if (dateRaw === '后天') dayOffset = 2;
      else if (dateRaw === '大后天') dayOffset = 3;
      const targetDate = new Date(shanghaiNow.getTime() + dayOffset * 24 * 3600 * 1000);
      const dateStr = targetDate.toISOString().slice(0, 10);
      return {
        reply: `好的，已添加：${title} ${dateStr} 09:00 📅`,
        intent: 'schedule_add',
        matchedItems: [],
        scheduleEvents: [
          {
            title,
            date: dateStr,
            startTime: '09:00',
            endTime: '10:00',
            location: '',
            tag: 'life',
          },
        ],
      };
    }

    return null;
  }

  private fallbackChatReply(
    message: string,
    allItems: ItemLite[],
    bs: { location: string; locationCode: string; threshold: number },
    temporaryCarryItems: string[] = [],
  ): AIChatResponse {
    const trimmed = message.trim();

    if (/你好|嗨|hi|hello|在吗/i.test(trimmed)) {
      return { reply: '你好呀～我是小寻✨ 有什么物品想找吗？', intent: 'chat' };
    }

    const itemKeywords2 = ['钥匙', '钱包', '眼镜', '手机', '耳机', '雨伞', '水杯', '门禁', '工牌', '身份证', '护照', '充电器', '充电宝', '眼镜盒', '笔记本', '书本', '文件', '公文包', '书包', '手套', '围巾', '帽子'];
    let findKeyword2 = '';
    for (const kw of itemKeywords2) {
      if (trimmed.includes(kw)) { findKeyword2 = kw; break; }
    }
    if (!findKeyword2 && /找|我的/.test(trimmed)) {
      findKeyword2 = 'find_generic';
    }
    if (findKeyword2 && findKeyword2 !== 'find_generic') {
      const found = allItems.find((it: ItemLite) => it.name.includes(findKeyword2));
      if (found) {
        const room = inferRoom(found.isStored, found.signalStrength, bs.location, bs.threshold);
        return {
          reply: `找到了！${found.name}在${room}，信号强度 ${found.signalStrength}%。`,
          intent: 'find_items',
          matchedItem: { id: found.id, name: found.name, isStored: found.isStored, location: room },
          matchedItems: [
            {
              id: found.id,
              name: found.name,
              reason: `在${room}，信号 ${found.signalStrength}%`,
              isStored: found.isStored,
              signalStrength: found.signalStrength,
              location: room,
            },
          ],
        };
      }
      return { reply: '还没登记这个物品哦，可以先去贴个贴纸登记一下～✨', intent: 'chat' };
    }

    if (/今天.*带|出门.*带|必带|推荐|我要出门|我出门了|出门要带|我要出发了|我出发了|出发.*带|今天.*拿|带什么|拿什么/.test(trimmed)) {
      const baseRecs = allItems.slice(0, 3).map((it: ItemLite) => {
        const room = inferRoom(it.isStored, it.signalStrength, bs.location, bs.threshold);
        return {
          id: it.id,
          name: it.name,
          reason: `在${room}，信号 ${it.signalStrength}%`,
          isStored: it.isStored,
          signalStrength: it.signalStrength,
          location: room,
        };
      });
      const tempItems = temporaryCarryItems.filter(
        (name: string) => !baseRecs.some((r) => r.name === name),
      );
      const tempRecs = tempItems.map((name: string) => {
        const found = allItems.find((it: ItemLite) => it.name === name || it.name.includes(name) || name.includes(it.name));
        if (found) {
          const room = inferRoom(found.isStored, found.signalStrength, bs.location, bs.threshold);
          return {
            id: found.id,
            name: found.name,
            reason: `你说要记得带的，在${room}`,
            isStored: found.isStored,
            signalStrength: found.signalStrength,
            location: room,
          };
        }
        return {
          id: `temp_${name}`,
          name,
          reason: '你说要记得带的，记得带上哦',
          isStored: false,
          signalStrength: 0,
          location: '',
        };
      });
      const recs = [...baseRecs, ...tempRecs];
      const replyLines: string[] = ['出门必带清单来啦👇'];
      for (const r of recs) {
        if (r.id.startsWith('temp_')) {
          replyLines.push(`· ${r.name}（你说要记得带的，别忘了）`);
        } else if (r.isStored) {
          replyLines.push(`· ${r.name}在${r.location}，记得去拿`);
        } else {
          replyLines.push(`· ${r.name}（已经带着了，不用找）`);
        }
      }
      return {
        reply: replyLines.join('\n'),
        intent: 'daily_items',
        matchedItems: recs,
        matchedItem: recs[0]
          ? { id: recs[0].id, name: recs[0].name, isStored: recs[0].isStored, location: recs[0].location }
          : undefined,
      };
    }

    const nameMatch2 = /(?:命名为|改名为|改名|叫|这个叫|刚贴的.*?叫|它叫).{0,6}?([^，。！？、\s]{1,20})$/.exec(trimmed);
    if (nameMatch2 && nameMatch2[1]) {
      const newName = nameMatch2[1].trim();
      if (newName.length > 0 && newName.length <= 20 && /[^a-zA-Z0-9]/.test(newName)) {
        const unnamedStored = allItems
          .filter((it: ItemLite) => it.isStored && (!it.name || it.name.trim() === ''))
          .sort((a: ItemLite, b: ItemLite) =>
            new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
          );
        const target = unnamedStored[0];
        if (target) {
          return {
            reply: `好的，已命名为：${newName} ✨`,
            intent: 'name_item',
            matchedItems: [],
            namedItem: {
              id: target.id,
              name: newName,
              isStored: target.isStored,
              location: target.location,
            },
            registerItemName: newName,
          };
        }
        return {
          reply: '暂时没有待命名的新物品哦～先贴个贴纸、等它存入后再告诉我名字吧！',
          intent: 'chat',
        };
      }
    }

    if (/登记|录入|这叫|这个叫|这是|这个是/.test(trimmed)) {
      const nameMatch = /(?:登记|录入|这叫|这个叫|这是|这个是)\s*(.+)/.exec(trimmed);
      const name = nameMatch?.[1]?.trim() ?? trimmed;
      return {
        reply: `好的～要把「${name}」登记为新物品对吗？`,
        intent: 'register_item',
        registerItemName: name,
      };
    }

    if (/你是谁|你叫什么/.test(trimmed)) {
      return {
        reply: '我是小寻呀～一只守护你所有物品的寻物小助手🐰 有什么东西找不到了就告诉我吧！',
        intent: 'chat',
      };
    }

    if (/谢谢|感谢|拜拜|再见/.test(trimmed)) {
      return { reply: '不客气～随时找我玩呀💕', intent: 'chat' };
    }

    if (allItems.length > 0) {
      const names = allItems.slice(0, 3).map((it: ItemLite) => it.name).join('、');
      return {
        reply: `小寻现在帮你看管着 ${allItems.length} 件物品呢，包括 ${names} 等～有什么需要帮忙的吗？`,
        intent: 'chat',
      };
    }
    return { reply: '嗯...这个小寻还不太懂呢😣 可以教教我吗～', intent: 'chat' };
  }

  async dailyRecommend(): Promise<AIDailyRecommendResponse> {
    try {
      const { items: allItems } = await this.itemsService.findAll(undefined, undefined, 1, 50);
      const namedItems = allItems.filter((it: ItemLite) => it.name && it.name.trim().length > 0);
      const { text: weather } = await this.fetchWeather();
      const schedules = await this.getTodaySchedules();
      const upcoming = await this.getUpcomingSchedules(3);
      const today = this.getShanghaiToday();

      const itemsText = namedItems.length > 0
        ? namedItems
            .map((it: ItemLite) => `${it.name}（${it.isStored ? '已存入' : '未存入'}，信号：${it.signalStrength}%）`)
            .join('、')
        : '暂无';

      const scheduleText = schedules.length > 0
        ? schedules
            .map(
              (s: Schedule) =>
                `${s.startTime}-${s.endTime} ${s.title}${s.location ? `（${s.location}）` : ''}`,
            )
            .join('；')
        : '今日暂无安排';

      const futureItems = upcoming.filter((s: Schedule) => s.scheduleDate > today);
      const futureText = futureItems.length > 0
        ? futureItems
            .map(
              (s: Schedule) =>
                `${s.scheduleDate} ${s.startTime} ${s.title}${s.location ? `（${s.location}）` : ''}`,
            )
            .join('；')
        : '暂无未来安排';

      const prompt = `今天（${today}）的天气：${weather}。
今天的日程：${scheduleText}。
未来日程：${futureText}。

这是用户的物品清单：${itemsText}。

请结合天气和日程（包括未来日程），从物品清单中推荐3-5件"今日必带物品"，并给出简短理由（不超过15字），理由里要体现和天气或日程的关联。
输出JSON格式：{"items": [{"name": "物品名", "reason": "理由"}], "summary": "一句话总结，要提到天气或日程"}`;

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
          temperature: 0.7,
          max_tokens: 400,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new BadRequestException('推荐服务暂时不可用');
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as {
        items?: Array<{ name: string; reason: string }>;
        summary?: string;
      };

      const recItems = (parsed.items ?? []).map((rec: { name: string; reason: string }) => {
        const found = namedItems.find(
          (it: ItemLite) =>
            it.name === rec.name || rec.name.includes(it.name) || it.name.includes(rec.name),
        );
        return {
          id: found?.id ?? '',
          name: rec.name,
          reason: rec.reason,
          isStored: found?.isStored ?? false,
        };
      });

      return {
        items: recItems.slice(0, 5),
        summary: parsed.summary ?? '小寻为你精选了今日必带物品～',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('每日推荐失败', msg);
      const { items: allItems } = await this.itemsService.findAll(undefined, undefined, 1, 5);
      const namedItems = allItems.filter((it: ItemLite) => it.name && it.name.trim().length > 0);
      return {
        items: namedItems.slice(0, 3).map((it: ItemLite) => ({
          id: it.id,
          name: it.name,
          reason: '日常必备',
          isStored: it.isStored,
        })),
        summary: '这是小寻为你推荐的今日必带物品～',
      };
    }
  }
}
