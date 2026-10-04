import { useState, useRef, useCallback, useEffect } from 'react';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import type {
  EchofindXiaoxunItemPhotoRecognitionOneOutput,
  EchofindVoiceToTextOneOutput,
} from '@shared/plugin-types';
import { echofind } from '@client/src/api';
import type { Item, QuickEntryItem, AIChatResponse } from '@shared/api.interface';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  type?:
    | 'text'
    | 'weather-card'
    | 'schedule-card'
    | 'item-list'
    | 'photo-preview'
    | 'quick-entry-confirm'
    | 'matched-item-card';
  payload?: unknown;
  streaming?: boolean;
}

interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  icon: string;
  rainProbability: number;
  wind: string;
  humidity: number;
  clothingAdvice: string;
}

interface ScheduleItem {
  time: string;
  event: string;
  location: string;
  type: 'meeting' | 'personal' | 'work' | 'other';
}

interface ScheduleData {
  date: string;
  items: ScheduleItem[];
}

interface RecommendedItem {
  item: Item;
  reason: string;
  status: 'stored' | 'not_stored' | 'offline';
}

interface MatchedItemPayload {
  item: Item;
  status: 'stored' | 'not_stored' | 'offline';
  reason?: string;
}

interface ItemListPayload {
  items: MatchedItemPayload[];
  summary?: string;
}

const IMAGE_PLUGIN_ID = 'echofind_xiaoxun_item_photo_recognition_1';
const VOICE_PLUGIN_ID = 'echofind_voice_to_text_1';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStream<T>(
  stream: AsyncIterable<T> | { output: AsyncIterable<T> },
): AsyncIterable<T> {
  if (Symbol.asyncIterator in stream) {
    return stream as AsyncIterable<T>;
  }
  return (stream as { output: AsyncIterable<T> }).output;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_init',
  role: 'assistant',
  content: '你好呀～我是小寻🐰 有什么物品需要帮忙找吗？',
  type: 'text',
};

export const useXiaoxunChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [items, setItems] = useState<Item[]>([]);
  const [pendingItems, setPendingItems] = useState<QuickEntryItem[]>([]);
  const [temporaryCarryItems, setTemporaryCarryItems] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);

  const currentPendingItem: QuickEntryItem | null = pendingItems[0] ?? null;

  useEffect(() => {
    const loadItems = async (): Promise<void> => {
      try {
        const res = await echofind.items.list({ pageSize: 20 });
        setItems(res.items);
      } catch (err) {
        logger.error('加载物品列表失败', err);
      }
    };
    void loadItems();
  }, []);

  const refreshPendingItems = useCallback(async (): Promise<void> => {
    try {
      const res = await echofind.items.quickEntryPending(20);
      setPendingItems(res.items);
    } catch (err) {
      logger.error('加载待录入物品失败', err);
    }
  }, []);

  useEffect(() => {
    void refreshPendingItems();
  }, [refreshPendingItems]);

  const scrollToBottom = useCallback((): void => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const addSchedulesFromAI = useCallback(
    async (events: Array<{
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      tag: 'work' | 'travel' | 'life' | 'other';
    }>): Promise<void> => {
      try {
        for (const ev of events) {
          await echofind.schedules.create({
            title: ev.title,
            scheduleDate: ev.date,
            startTime: ev.startTime,
            endTime: ev.endTime,
            location: ev.location || undefined,
            tag: ev.tag,
          });
        }
        window.dispatchEvent(new CustomEvent('echofind-schedule-updated'));
      } catch (err) {
        logger.error('写入日程失败', err);
      }
    },
    [],
  );

  const fetchAssistantReply = useCallback(
    async (question: string, history: ChatMessage[]): Promise<void> => {
      const assistantId = generateId();
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', type: 'text', streaming: true },
      ]);
      abortRef.current = false;
      setIsLoading(true);

      try {
        const historyPayload = history
          .filter((m: ChatMessage) => m.role !== 'error' && m.type === 'text')
          .map((m: ChatMessage) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        const stream = echofind.ai.chatStream({
          message: question,
          history: historyPayload,
          temporaryCarryItems,
        });

        let finalData: AIChatResponse | null = null;
        let accumulated = '';

        for await (const evt of stream) {
          if (abortRef.current) break;
          if (evt.type === 'delta') {
            accumulated += evt.content;
            setMessages((prev: ChatMessage[]) =>
              prev.map((m: ChatMessage) =>
                m.id === assistantId
                  ? { ...m, content: accumulated, streaming: true }
                  : m,
              ),
            );
          } else if (evt.type === 'done') {
            finalData = evt.data;
          }
        }

        if (abortRef.current) {
          setIsLoading(false);
          scrollToBottom();
          return;
        }

        const res = finalData ?? { reply: accumulated, intent: 'chat' as const };

        setMessages((prev: ChatMessage[]) =>
          prev.map((m: ChatMessage) =>
            m.id === assistantId
              ? { ...m, content: res.reply, streaming: false }
              : m,
          ),
        );

        if (res.temporaryCarryItems && res.temporaryCarryItems.length > 0) {
          setTemporaryCarryItems(res.temporaryCarryItems);
        }

        const hasMatchedItems =
          (res.matchedItems && res.matchedItems.length > 0) || !!res.matchedItem;

        if (hasMatchedItems && res.intent === 'daily_items') {
          const rawList =
            res.matchedItems && res.matchedItems.length > 0
              ? res.matchedItems
              : res.matchedItem
                ? [res.matchedItem]
                : [];

          const list: MatchedItemPayload[] = rawList.map(
            (raw: { id: string; name: string; isStored: boolean; signalStrength?: number; reason?: string }) => {
              const full = items.find((it: Item) => it.id === raw.id);
              const item: Item = full ?? {
                id: raw.id,
                name: raw.name,
                isStored: raw.isStored,
                signalStrength: raw.signalStrength ?? 0,
                reportTime: '',
                imageUrl: '',
                deviceId: '',
                disposition: 'keep',
                location: '',
              };
              return {
                item,
                status: raw.isStored ? 'stored' : 'not_stored',
                reason: raw.reason,
              };
            },
          );

          const listMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: res.reply || '',
            type: 'item-list',
            payload: { items: list } as ItemListPayload,
          };
          setMessages((prev: ChatMessage[]) => [...prev, listMsg]);
        }

        if (res.intent === 'register_item' && res.registerItemName && currentPendingItem) {
          const confirmMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: '',
            type: 'quick-entry-confirm',
            payload: { name: res.registerItemName },
          };
          setMessages((prev: ChatMessage[]) => [...prev, confirmMsg]);
        }

        if (res.intent === 'schedule_add' && res.scheduleEvents?.length) {
          void addSchedulesFromAI(res.scheduleEvents);
        }

        if (res.intent === 'name_item' && res.namedItem) {
          try {
            const updatedRes = await echofind.items.list({ pageSize: 20 });
            setItems(updatedRes.items);
            void refreshPendingItems();
          } catch (err) {
            logger.error('命名后刷新物品列表失败', err);
          }
        }

        if (res.intent === 'schedule_delete' && res.deletedSchedules?.length) {
          window.dispatchEvent(new CustomEvent('echofind-schedule-updated'));
        }

        if (res.intent === 'schedule_update' && res.updatedSchedule) {
          window.dispatchEvent(new CustomEvent('echofind-schedule-updated'));
        }

        if (res.intent === 'schedule_query') {
          const today = new Date().toISOString().slice(0, 10);
          try {
            const dayRes = await echofind.schedules.list({ date: today });
            const scheduleItems = dayRes.items.map((s) => ({
              time: s.startTime,
              event: s.title,
              location: s.location ?? '',
              type: (s.tag as ScheduleItem['type']) ?? 'work',
            }));
            const scheduleMsg: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: res.reply || '今天的日程安排如下：',
              type: 'schedule-card',
              payload: { date: today, items: scheduleItems } as ScheduleData,
            };
            setMessages((prev: ChatMessage[]) => [...prev, scheduleMsg]);
          } catch {
            // 查不到就只显示文字回复
          }
        }
      } catch (err) {
        logger.error('AI 对话调用失败', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`小寻回复失败: ${errorMsg}`);
        setMessages((prev: ChatMessage[]) =>
          prev.map((m: ChatMessage) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  role: 'error',
                  content: `抱歉，小寻暂时无法回答（${errorMsg}）。请稍后再试。`,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [items, scrollToBottom, currentPendingItem, addSchedulesFromAI],
  );

  const sendMessage = useCallback(
    (text: string): void => {
      logger.info('[xiaoxun] sendMessage called', { textLen: text.length, isLoading });
      if (!text.trim()) {
        logger.info('[xiaoxun] sendMessage skipped: empty text');
        return;
      }
      if (isLoading) {
        logger.info('[xiaoxun] sendMessage skipped: isLoading true');
        return;
      }
      try {
        const userMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: text.trim(),
          type: 'text',
        };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        scrollToBottom();
        void fetchAssistantReply(text.trim(), newHistory);
      } catch (err) {
        logger.error('[xiaoxun] sendMessage unexpected error', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`发送失败: ${errorMsg}`);
      }
    },
    [messages, isLoading, fetchAssistantReply, scrollToBottom],
  );

  const showWeatherCard = useCallback((): void => {
    if (isLoading) return;
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: '今日天气怎么样？',
      type: 'text',
    };
    const weatherMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '暂未接入天气数据，你可以问问我物品在哪哦～',
      type: 'text',
    };
    setMessages((prev: ChatMessage[]) => [...prev, userMsg, weatherMsg]);
    scrollToBottom();
  }, [isLoading, scrollToBottom]);

  const showScheduleCard = useCallback(async (): Promise<void> => {
    if (isLoading) return;
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: '今天有什么安排？',
      type: 'text',
    };
    const loadingMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '正在查询...',
      type: 'text',
    };
    setMessages((prev: ChatMessage[]) => [...prev, userMsg, loadingMsg]);
    scrollToBottom();
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { items } = await echofind.schedules.list({ date: today });
      const scheduleItems: ScheduleItem[] = items.map((s) => ({
        time: s.startTime,
        event: s.title,
        location: s.location ?? '',
        type: (s.tag as ScheduleItem['type']) ?? 'work',
      }));
      const scheduleMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: scheduleItems.length > 0 ? '今天的日程安排如下：' : '今天还没有安排哦～',
        type: scheduleItems.length > 0 ? 'schedule-card' : 'text',
        payload: scheduleItems.length > 0
          ? { date: today, items: scheduleItems } as ScheduleData
          : undefined,
      };
      setMessages((prev: ChatMessage[]) => {
        const filtered = prev.filter((m: ChatMessage) => m.id !== loadingMsg.id);
        return [...filtered, scheduleMsg];
      });
      scrollToBottom();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '查询失败';
      const failMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `日程查询失败了：${msg}`,
        type: 'text',
      };
      setMessages((prev: ChatMessage[]) => {
        const filtered = prev.filter((m: ChatMessage) => m.id !== loadingMsg.id);
        return [...filtered, failMsg];
      });
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  const addScheduleItem = useCallback(
    (item: Omit<ScheduleItem, 'type'> & { type?: ScheduleItem['type'] }): void => {
      const newItem: ScheduleItem = { ...item, type: item.type ?? 'personal' };
      setMessages((prev: ChatMessage[]) =>
        prev.map((m: ChatMessage) => {
          if (m.type !== 'schedule-card' || !m.payload) return m;
          const data = m.payload as ScheduleData;
          return {
            ...m,
            payload: {
              ...data,
              items: [...data.items, newItem].sort(
                (a: ScheduleItem, b: ScheduleItem) => a.time.localeCompare(b.time),
              ),
            },
          };
        }),
      );
    },
    [],
  );

  const recognizePhoto = useCallback(
    async (file: File): Promise<Item | null> => {
      const previewMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: '',
        type: 'photo-preview',
        payload: URL.createObjectURL(file),
      };
      setMessages((prev: ChatMessage[]) => [...prev, previewMsg]);
      scrollToBottom();

      const assistantId = generateId();
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', type: 'text', streaming: true },
      ]);
      setIsLoading(true);

      try {
        const rawStream = capabilityClient
          .load(IMAGE_PLUGIN_ID)
          .callStream<EchofindXiaoxunItemPhotoRecognitionOneOutput>('imageUnderstanding', {
            item_photo: [file as unknown as string],
          });
        const stream = normalizeStream(rawStream);
        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk.content ?? '';
          setMessages((prev: ChatMessage[]) =>
            prev.map((m: ChatMessage) =>
              m.id === assistantId ? { ...m, content: fullContent } : m,
            ),
          );
          scrollToBottom();
        }
        setMessages((prev: ChatMessage[]) =>
          prev.map((m: ChatMessage) =>
            m.id === assistantId ? { ...m, streaming: false } : m,
          ),
        );

        // 简单匹配物品库
        const matched = items.find((it: Item) =>
          fullContent.toLowerCase().includes(it.name.toLowerCase()),
        );
        return matched ?? items[0] ?? null;
      } catch (err) {
        logger.error('图片识别失败', err);
        setMessages((prev: ChatMessage[]) =>
          prev.map((m: ChatMessage) =>
            m.id === assistantId
              ? { ...m, streaming: false, role: 'error', content: '图片识别失败，请重试。' }
              : m,
          ),
        );
        return null;
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [items, scrollToBottom],
  );

  const quickEntryItem = useCallback(
    async (name: string): Promise<{ success: boolean; item?: QuickEntryItem }> => {
      if (!currentPendingItem) {
        setMessages((prev: ChatMessage[]) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: '暂时没有待录入的贴纸哦，先让贴纸靠近一下基站吧～',
            type: 'text',
          },
        ]);
        scrollToBottom();
        return { success: false };
      }
      try {
        const res = await echofind.items.quickEntrySubmit({
          id: currentPendingItem.id,
          name,
          isStored: false,
        });
        if (res.success && res.item) {
          setPendingItems((prev: QuickEntryItem[]) =>
            prev.filter((it: QuickEntryItem) => it.id !== currentPendingItem.id),
          );
          const successMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `🎉 好嘞！「${name}」已经登记成功啦～以后想找它随时告诉我！`,
            type: 'text',
          };
          setMessages((prev: ChatMessage[]) => [...prev, successMsg]);
          scrollToBottom();
          return { success: true, item: res.item };
        }
        return { success: false };
      } catch (err) {
        logger.error('快速录入物品失败', err);
        const failMsg: ChatMessage = {
          id: generateId(),
          role: 'error',
          content: '登记失败了，稍后再试一下吧～',
          type: 'text',
        };
        setMessages((prev: ChatMessage[]) => [...prev, failMsg]);
        scrollToBottom();
        return { success: false };
      }
    },
    [currentPendingItem, scrollToBottom],
  );

  const recognizeVoice = useCallback(
    async (base64Wav: string, len: number): Promise<{ text: string }> => {
      const result = await echofind.voice.asr(base64Wav, len);
      return { text: result.text ?? '' };
    },
    [],
  );

  const searchItems = useCallback(
    (keyword: string): Item[] => {
      if (!keyword.trim()) return [];
      const kw = keyword.toLowerCase();
      return items
        .filter((it: Item) => it.name.toLowerCase().includes(kw))
        .slice(0, 5);
    },
    [items],
  );

  return {
    messages,
    isLoading,
    items,
    pendingItems,
    currentPendingItem,
    messagesEndRef,
    sendMessage,
    showWeatherCard,
    showScheduleCard,
    addScheduleItem,
    recognizePhoto,
    recognizeVoice,
    searchItems,
    quickEntryItem,
    refreshPendingItems,
  };
};
