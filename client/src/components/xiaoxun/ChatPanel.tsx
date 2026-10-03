import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Mic,
  Camera,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Plus,
  Briefcase,
  User,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Signal,
  Wifi,
  Volume2,
  VolumeX,
  Package,
  X as XIcon,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import Image from '@client/src/components/ui/image';
import ItemIcon from '@client/src/components/ui/item-icon';
import { Markdown } from '@client/src/components/ui/markdown';
import { PET_IMAGE_MAP, PET_NAME_MAP, DEFAULT_PET } from './petData';
import PetAvatar from './PetAvatar';
import type { PetType } from '@shared/api.interface';
import type { ChatMessage } from './useXiaoxunChat';
import type { Item, QuickEntryItem } from '@shared/api.interface';

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

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  currentPendingItem: QuickEntryItem | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendMessage: (text: string) => void;
  onShowWeather: () => void;
  onShowSchedule: () => void;
  onAddSchedule: (item: Omit<ScheduleItem, 'type'> & { type?: ScheduleItem['type'] }) => void;
  onRecognizePhoto: (file: File) => Promise<Item | null>;
  onRecognizeVoice: (audioFile: File) => Promise<{ text: string }>;
  onSearchItems: (keyword: string) => Item[];
  onItemClick: (item: Item) => void;
  onFindItem?: (item: Item) => void;
  onQuickEntryConfirm: (name: string) => void;
  onQuickEntryCancel: () => void;
  petType?: PetType;
}

const statusDotColor = (status: 'stored' | 'not_stored' | 'offline'): string => {
  switch (status) {
    case 'stored':
      return 'bg-[#00B894]';
    case 'not_stored':
      return 'bg-[#FDCB6E]';
    case 'offline':
      return 'bg-[#B2BEC3]';
  }
};

const statusText = (status: 'stored' | 'not_stored' | 'offline'): string => {
  switch (status) {
    case 'stored':
      return '已存入';
    case 'not_stored':
      return '未存入';
    case 'offline':
      return '离线';
  }
};

const getScheduleIcon = (type: ScheduleItem['type']): React.ReactNode => {
  switch (type) {
    case 'meeting':
      return <Briefcase size={14} className="text-[#6C5CE7]" />;
    case 'work':
      return <Briefcase size={14} className="text-[#00B894]" />;
    case 'personal':
      return <User size={14} className="text-[#74B9FF]" />;
    default:
      return <Calendar size={14} className="text-[#B2BEC3]" />;
  }
};

const signalBars = (strength: number): number => {
  if (strength >= 80) return 4;
  if (strength >= 60) return 3;
  if (strength >= 40) return 2;
  if (strength >= 20) return 1;
  return 0;
};

const MatchedItemCard: React.FC<{
  item: Item;
  onClick: (item: Item) => void;
  onFind?: (item: Item) => void;
}> = ({ item, onClick, onFind }) => {
  const status: 'stored' | 'not_stored' | 'offline' = item.isStored ? 'stored' : 'not_stored';
  return (
    <div className="space-y-2">
      <button
        onClick={() => onClick(item)}
        className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/60 hover:bg-white transition-colors text-left border border-[#DFE6E9]"
      >
      <div className="w-10 h-10 rounded-lg bg-[#F5F6FA] overflow-hidden flex-shrink-0">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <ItemIcon name={item.name} className="w-full h-full" size={40} />
        )}
      </div>
       <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#2D3436] truncate">
            {item.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.location && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6C5CE7]/10 text-[#6C5CE7] font-medium">
              {item.location}
            </span>
          )}
          <span className="text-[10px] font-mono text-[#B2BEC3] truncate">
            {item.deviceId}
          </span>
        </div>
      </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDotColor(status)}`} />
          <span className="text-xs text-[#636E72]">{statusText(status)}</span>
        </div>
      </button>
      {onFind && (
        <button
          onClick={(e: React.MouseEvent): void => { e.stopPropagation(); onFind(item); }}
          className="w-full h-9 rounded-lg bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:shadow-md hover:shadow-[#6C5CE7]/20 transition-all"
        >
          <Wifi size={12} />
          开始寻找
        </button>
      )}
    </div>
  );
};

const ItemListCard: React.FC<{
  items: Array<{ item: Item; status: 'stored' | 'not_stored' | 'offline'; reason?: string }>;
  onClick: (item: Item) => void;
  onFind?: (item: Item) => void;
  compact?: boolean;
}> = ({ items, onClick, onFind, compact = false }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string): void => {
    setOpenIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (compact) {
    return (
      <div className="space-y-1.5">
        {items.map((entry, idx) => {
          const key = entry.item.id || String(idx);
          const isOpen = openIds.has(key);
          return (
            <div
              key={key}
              className="rounded-lg border border-[#DFE6E9] overflow-hidden bg-white/80"
            >
              <button
                onClick={() => toggleItem(key)}
                className="w-full flex items-center gap-2 p-2 hover:bg-[#F5F6FA] transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-md bg-[#F5F6FA] overflow-hidden flex-shrink-0">
                  {entry.item.imageUrl ? (
                    <Image
                      src={entry.item.imageUrl}
                      alt={entry.item.name}
                      width={28}
                      height={28}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ItemIcon name={entry.item.name} className="w-full h-full" size={28} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#2D3436] truncate">
                    {entry.item.name}
                  </div>
                </div>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotColor(entry.status)}`} />
                {isOpen ? (
                  <ChevronUp size={12} className="text-[#B2BEC3] flex-shrink-0" />
                ) : (
                  <ChevronDown size={12} className="text-[#B2BEC3] flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-2 pb-2 pt-0 space-y-1.5 border-t border-[#F5F6FA]">
                   <div className="text-[11px] text-[#636E72] leading-relaxed">
                    {entry.reason || (entry.item.isStored ? '已存入阻隔盒' : '未存入')}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#B2BEC3]">
                    <span className="font-mono">{entry.item.deviceId}</span>
                    <span>信号 {Math.round(entry.item.signalStrength)}%</span>
                  </div>
                  {entry.item.location && (
                    <div className="text-[10px] text-[#6C5CE7] font-medium">
                      📍 {entry.item.location}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#B2BEC3]">{statusText(entry.status)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e: React.MouseEvent): void => { e.stopPropagation(); onClick(entry.item); }}
                        className="text-[#6C5CE7] hover:underline"
                      >
                        详情
                      </button>
                      {onFind && (
                        <button
                          onClick={(e: React.MouseEvent): void => { e.stopPropagation(); onFind(entry.item); }}
                          className="text-[#00B894] hover:underline"
                        >
                          寻找
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-[240px]">
      {items.map((entry, idx) => (
        <div key={entry.item.id || idx} className="space-y-2">
          <button
            onClick={() => onClick(entry.item)}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/80 hover:bg-white transition-colors text-left border border-[#DFE6E9] hover:border-[#6C5CE7]/40"
          >
          <div className="w-10 h-10 rounded-lg bg-[#F5F6FA] overflow-hidden flex-shrink-0">
            {entry.item.imageUrl ? (
              <Image
                src={entry.item.imageUrl}
                alt={entry.item.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <ItemIcon name={entry.item.name} className="w-full h-full" size={40} />
            )}
          </div>
           <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#2D3436] truncate">
              {entry.item.name}
            </div>
            <div className="text-xs text-[#636E72] truncate flex items-center gap-1.5">
              {entry.item.location && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-[#6C5CE7]/10 text-[#6C5CE7] font-medium">
                  {entry.item.location}
                </span>
              )}
              {entry.reason || (entry.item.isStored ? '已存入阻隔盒' : '未存入')}
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span className={`w-2 h-2 rounded-full ${statusDotColor(entry.status)}`} />
            <span className="text-[10px] text-[#B2BEC3] font-mono">{Math.round(entry.item.signalStrength)}%</span>
          </div>
        </button>
        {onFind && (
          <button
            onClick={(e: React.MouseEvent): void => { e.stopPropagation(); onFind(entry.item); }}
            className="w-full h-8 rounded-lg bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white text-[11px] font-medium flex items-center justify-center gap-1 hover:shadow-md hover:shadow-[#6C5CE7]/20 transition-all"
          >
            <Wifi size={11} />
            开始寻找
          </button>
        )}
        </div>
      ))}
    </div>
  );
};

const QuickEntryConfirmCard: React.FC<{
  name: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}> = ({ name, onConfirm, onCancel }) => (
  <div className="mt-2 space-y-3">
    <div className="text-sm text-[#2D3436]">
      检测到待录入贴纸，要把 <span className="font-semibold text-[#6C5CE7]">「{name}」</span> 登记为新物品吗？
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => onConfirm(name)}
        className="flex-1 h-9 rounded-lg bg-[#6C5CE7] text-white text-sm font-medium hover:bg-[#5B4CDB] active:bg-[#5B4CDB] transition-colors"
      >
        确认登记
      </button>
      <button
        onClick={onCancel}
        className="flex-1 h-9 rounded-lg bg-white text-[#636E72] text-sm font-medium border border-[#DFE6E9] hover:bg-[#F5F6FA] transition-colors"
      >
        取消
      </button>
    </div>
  </div>
);

const TypingDots: React.FC = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    <span className="w-2 h-2 rounded-full bg-[#B2BEC3] animate-bounce [animation-delay:-0.3s]" />
    <span className="w-2 h-2 rounded-full bg-[#B2BEC3] animate-bounce [animation-delay:-0.15s]" />
    <span className="w-2 h-2 rounded-full bg-[#B2BEC3] animate-bounce" />
  </div>
);

const WeatherCard: React.FC<{ data: WeatherData }> = ({ data }) => (
  <div className="mt-2 p-4 rounded-2xl bg-gradient-to-br from-[#74B9FF20] to-[#6C5CE720] border border-[#DFE6E9]">
    <div className="flex items-start justify-between mb-3">
      <div>
        <div className="text-xs text-[#636E72]">{data.city}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-[#2D3436]">{data.temperature}</span>
          <span className="text-sm text-[#636E72]">°C</span>
        </div>
        <div className="text-sm text-[#636E72]">{data.condition}</div>
      </div>
      <span className="text-4xl">{data.icon}</span>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
      <div className="flex flex-col items-center gap-1">
        <CloudRain size={14} className="text-[#74B9FF]" />
        <span className="text-[#636E72]">{data.rainProbability}%</span>
        <span className="text-[#B2BEC3]">降水</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Wind size={14} className="text-[#636E72]" />
        <span className="text-[#636E72]">{data.wind.split(' ')[1]}</span>
        <span className="text-[#B2BEC3]">风力</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Droplets size={14} className="text-[#74B9FF]" />
        <span className="text-[#636E72]">{data.humidity}%</span>
        <span className="text-[#B2BEC3]">湿度</span>
      </div>
    </div>
    <div className="text-xs text-[#636E72] bg-white/60 rounded-lg p-2">
      💡 {data.clothingAdvice}
    </div>
  </div>
);

const ScheduleCard: React.FC<{
  data: ScheduleData;
  onAdd: (item: Omit<ScheduleItem, 'type'> & { type?: ScheduleItem['type'] }) => void;
}> = ({ data, onAdd }) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [time, setTime] = useState<string>('');
  const [event, setEvent] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  const handleAdd = (): void => {
    if (!time || !event) return;
    onAdd({ time, event, location: location || '未设置' });
    setTime('');
    setEvent('');
    setLocation('');
    setShowAddForm(false);
  };

  return (
    <div className="mt-2 rounded-2xl bg-[#FFF8E7] border border-[#F5E6C8] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-[#B8860B]" />
        <span className="text-sm font-semibold text-[#5C4A1F]">时间安排表</span>
        <span className="text-xs text-[#A08050]">{data.date}</span>
      </div>
      <div className="space-y-0">
        {data.items.map((item: ScheduleItem, index: number) => (
          <div key={index}>
            {index > 0 && <div className="mx-2 border-t border-dashed border-[#E8D5A3]/60" />}
            <div className="flex items-center gap-3 py-2.5 px-2">
              <div className="flex-shrink-0 w-20 text-xs font-medium text-[#8B6914] tabular-nums">
                {item.time}
              </div>
              <div className="w-px h-4 bg-[#E8D5A3]" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#3D3015] truncate font-medium">{item.event}</div>
                {item.location && item.location !== '未设置' && (
                  <div className="flex items-center gap-1 text-xs text-[#A08050] mt-0.5">
                    <MapPin size={10} />
                    <span className="truncate">{item.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showAddForm ? (
        <div className="mt-3 p-3 rounded-xl bg-white/70 space-y-2 border border-[#F0DFB0]">
          <input
            type="time"
            value={time}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value)}
            className="w-full h-8 px-3 rounded-md border border-[#E8D5A3] text-sm bg-white outline-none focus:border-[#B8860B]"
          />
          <input
            type="text"
            placeholder="事件名称"
            value={event}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEvent(e.target.value)}
            className="w-full h-8 px-3 rounded-md border border-[#E8D5A3] text-sm bg-white outline-none focus:border-[#B8860B]"
          />
          <input
            type="text"
            placeholder="地点"
            value={location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
            className="w-full h-8 px-3 rounded-md border border-[#E8D5A3] text-sm bg-white outline-none focus:border-[#B8860B]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 h-8 rounded-md bg-[#B8860B] text-white text-xs font-medium hover:bg-[#996F0A] transition-colors"
            >
              确认添加
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 h-8 rounded-md bg-white text-[#8B6914] text-xs font-medium border border-[#E8D5A3] hover:bg-[#FFF8E7] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-3 w-full h-9 rounded-xl border border-dashed border-[#E8D5A3] text-xs text-[#A08050] flex items-center justify-center gap-1 hover:border-[#B8860B] hover:text-[#B8860B] transition-colors"
        >
          <Plus size={14} />
          新增日程
        </button>
      )}
    </div>
  );
};

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  isLoading,
  currentPendingItem,
  messagesEndRef,
  onSendMessage,
  onShowWeather,
  onShowSchedule,
  onAddSchedule,
  onRecognizePhoto,
  onRecognizeVoice,
  onSearchItems,
  onItemClick,
  onFindItem,
  onQuickEntryConfirm,
  onQuickEntryCancel,
  petType,
}) => {
  const [pendingBarExpanded, setPendingBarExpanded] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [showItemListPopup, setShowItemListPopup] = useState<boolean>(false);
  const [voiceBroadcast, setVoiceBroadcast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('xiaoxun-voice-broadcast') === 'true';
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const broadcastedMsgIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!inputValue.trim()) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    const results = onSearchItems(inputValue);
    setSearchResults(results);
    setShowSuggestions(results.length > 0);
  }, [inputValue, onSearchItems]);

  const handleSend = (): void => {
    logger.info('[ChatPanel] handleSend called', { hasText: !!inputValue.trim(), isLoading });
    if (!inputValue.trim()) {
      logger.info('[ChatPanel] handleSend skipped: empty input');
      return;
    }
    if (isLoading) {
      logger.info('[ChatPanel] handleSend skipped: loading');
      return;
    }
    try {
      onSendMessage(inputValue);
      setInputValue('');
      setShowSuggestions(false);
    } catch (err) {
      logger.error('[ChatPanel] handleSend error', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`发送失败: ${errorMsg}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceBroadcast = (): void => {
    const next = !voiceBroadcast;
    setVoiceBroadcast(next);
    try {
      localStorage.setItem('xiaoxun-voice-broadcast', String(next));
    } catch {
      // ignore
    }
    if (!next && utteranceRef.current) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      utteranceRef.current = null;
    }
  };

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[-*+]\s+/gm, '· ')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s*/gm, '')
      .replace(/---+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n');
  };

  const speakText = useCallback((text: string, msgId: string): void => {
    if (!voiceBroadcast) return;
    if (!text || !text.trim()) return;
    if (broadcastedMsgIdsRef.current.has(msgId)) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    broadcastedMsgIdsRef.current.add(msgId);
    const cleanText = stripMarkdown(text);
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = 'zh-CN';
      utter.rate = 1.0;
      utter.pitch = 1.1;
      utteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      logger.warn('TTS 语音播报失败', err);
    }
  }, [voiceBroadcast]);

  useEffect(() => {
    if (!voiceBroadcast) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg.type !== 'text') return;
    if (lastMsg.streaming) return;
    if (!lastMsg.content || !lastMsg.content.trim()) return;
    speakText(lastMsg.content, lastMsg.id);
  }, [messages, voiceBroadcast, speakText]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const audioContextToWav = (audioBuffer: AudioBuffer): Blob => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = audioBuffer.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string): void => {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c += 1) {
      channels.push(audioBuffer.getChannelData(c));
    }
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i += 1) {
      for (let c = 0; c < numChannels; c += 1) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const isSecureContext = (): boolean => {
    if (typeof window === 'undefined') return true;
    return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  };

  const handleVoiceClick = (): void => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      isRecognizingRef.current = false;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      setIsRecognizing(false);
      return;
    }

    if (!SpeechRecognition) {
      toast.error('当前浏览器不支持实时语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    if (!isSecureContext()) {
      toast.error('语音识别需要 HTTPS 安全环境，请在 HTTPS 页面或 localhost 下使用');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      let finalText = '';
      let interimText = '';

      recognition.onresult = (event: any): void => {
        interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }
        const fullText = (finalText + interimText).trim();
        if (fullText) {
          setInputValue(fullText);
        }
      };

      recognition.onerror = (event: any): void => {
        logger.error('语音识别错误', event.error);
        const err = event.error;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast.error('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风');
        } else if (err === 'no-speech') {
          toast.warning('未检测到语音内容，请重试');
        } else if (err === 'audio-capture') {
          toast.error('未检测到麦克风设备，请检查硬件连接');
        } else if (err === 'network') {
          toast.error('语音识别网络错误，请检查网络连接');
        } else {
          toast.error(`语音识别错误: ${err}`);
        }
        isRecognizingRef.current = false;
        setIsRecording(false);
        setIsRecognizing(false);
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        recognitionRef.current = null;
      };

      recognition.onend = (): void => {
        if (!isRecognizingRef.current) return;
        const finalTrim = finalText.trim();
        if (finalTrim) {
          setInputValue(finalTrim);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        } else if (!interimText.trim()) {
          toast.warning('未识别到语音内容，请重试');
        }
        isRecognizingRef.current = false;
        setIsRecording(false);
        setIsRecognizing(false);
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        recognitionRef.current = null;
      };

      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev: number) => prev + 1);
      }, 1000);

      isRecognizingRef.current = true;
      setIsRecognizing(true);
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      logger.error('启动语音识别失败', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`启动语音识别失败: ${msg}`);
      isRecognizingRef.current = false;
      setIsRecording(false);
      setIsRecognizing(false);
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handlePhotoClick = (): void => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    const matchedItem = await onRecognizePhoto(file);
    if (matchedItem) {
      onItemClick(matchedItem);
    }
    e.target.value = '';
  };

  const handleItemSearchClick = (item: Item): void => {
    onItemClick(item);
    setShowSuggestions(false);
    setInputValue('');
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-48px)] h-[70vh] max-h-[680px] bg-white rounded-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#DFE6E9]">
            <div className="flex items-center gap-3">
              <PetAvatar petType={petType ?? DEFAULT_PET} size={40} />
            <div>
              <div className="text-sm font-semibold text-[#2D3436]">小寻</div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00B894]" />
                <span className="text-xs text-[#B2BEC3]">在线</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleVoiceBroadcast}
              className={`p-2 rounded-lg transition-colors ${
                voiceBroadcast
                  ? 'bg-[#6C5CE710] text-[#6C5CE7]'
                  : 'hover:bg-[#F5F6FA] text-[#B2BEC3]'
              }`}
              title={voiceBroadcast ? '语音播报已开启' : '语音播报已关闭'}
            >
              {voiceBroadcast ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#F5F6FA] transition-colors text-[#636E72]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current Pending Item Bar */}
        {currentPendingItem && (
          <button
            onClick={() => setPendingBarExpanded((prev: boolean) => !prev)}
            className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#6C5CE710] to-[#A29BFE10] border-b border-[#DFE6E9] hover:from-[#6C5CE715] hover:to-[#A29BFE15] transition-colors w-full text-left"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base">📌</span>
              <div className="min-w-0 flex-1">
                <div className={`text-xs text-[#636E72] mb-0.5 ${pendingBarExpanded ? '' : 'hidden'}`}>
                  贴纸编号
                </div>
                <div className={`font-mono font-semibold text-[#2D3436] ${pendingBarExpanded ? 'text-sm break-all' : 'text-base truncate'}`}>
                  {currentPendingItem.deviceId}
                </div>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#FDCB6E20] text-[#E17055] border border-[#FDCB6E40]">
                待录入
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1 text-[#636E72]">
                <Signal size={14} />
                <span className="text-xs font-mono">{Math.round(currentPendingItem.signalStrength)}</span>
              </div>
              {pendingBarExpanded ? (
                <ChevronUp size={14} className="text-[#B2BEC3]" />
              ) : (
                <ChevronDown size={14} className="text-[#B2BEC3]" />
              )}
            </div>
          </button>
        )}

        {/* Messages + Quick Actions + Recommended Items (scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Messages */}
          <div className="p-4 space-y-3">
          {messages.map((msg: ChatMessage) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && msg.type !== 'text' && (
                <div className="flex-shrink-0 mr-2 mt-1">
                  <PetAvatar petType={petType ?? DEFAULT_PET} size={20} />
                </div>
              )}
              <div
                className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-[#6C5CE7] text-white rounded-2xl rounded-br-sm'
                    : msg.role === 'error'
                      ? 'bg-[#FFF0F0] text-[#E17055] rounded-2xl rounded-bl-sm'
                      : 'bg-[#F5F6FA] text-[#2D3436] rounded-2xl rounded-bl-sm'
                } px-4 py-2.5 text-sm leading-relaxed break-words`}
              >
                {msg.type === 'weather-card' ? (
                  <div>
                    <div className="mb-1">{msg.content}</div>
                    <WeatherCard data={msg.payload as WeatherData} />
                  </div>
                ) : msg.type === 'schedule-card' ? (
                  <div>
                    <div className="mb-1">{msg.content}</div>
                    <ScheduleCard
                      data={msg.payload as ScheduleData}
                      onAdd={onAddSchedule}
                    />
                  </div>
                ) : msg.type === 'photo-preview' ? (
                  <Image
                    src={msg.payload as string}
                    alt="上传图片"
                    className="rounded-lg max-w-full"
                  />
                ) : msg.type === 'item-list' ? (
                  <div>
                    {msg.content && <div className="mb-2">{msg.content}</div>}
                    <button
                      onClick={(e: React.MouseEvent): void => {
                        e.stopPropagation();
                        setShowItemListPopup(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#6C5CE710] text-[#6C5CE7] text-xs font-medium hover:bg-[#6C5CE720] transition-colors border border-[#6C5CE720]"
                    >
                      <Package size={12} />
                      物品清单
                      <span className="bg-white/60 px-1.5 rounded-full text-[10px] font-semibold">
                        {(msg.payload as { items: Array<{ item: Item }> }).items.length}
                      </span>
                      <ChevronRight size={12} />
                    </button>
                    {showItemListPopup && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowItemListPopup(false)}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <div
                          className="relative w-[85%] max-w-[320px] max-h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                          onClick={(e: React.MouseEvent): void => { e.stopPropagation(); }}
                        >
                          <div className="flex items-center justify-between px-4 py-3 border-b border-[#DFE6E9]">
                            <div className="flex items-center gap-2">
                              <Package size={16} className="text-[#6C5CE7]" />
                              <span className="text-sm font-semibold text-[#2D3436]">物品清单</span>
                              <span className="text-[11px] text-[#B2BEC3]">
                                共 {(msg.payload as { items: Array<{ item: Item }> }).items.length} 件
                              </span>
                            </div>
                            <button
                              onClick={() => setShowItemListPopup(false)}
                              className="p-1 rounded-lg hover:bg-[#F5F6FA] text-[#B2BEC3] transition-colors"
                            >
                              <XIcon size={16} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-3">
                            <ItemListCard
                              items={(msg.payload as { items: Array<{ item: Item; status: 'stored' | 'not_stored' | 'offline'; reason?: string }> }).items}
                              onClick={(item: Item): void => {
                                setShowItemListPopup(false);
                                onItemClick(item);
                              }}
                              onFind={onFindItem ? (item: Item): void => {
                                setShowItemListPopup(false);
                                onFindItem(item);
                              } : undefined}
                              compact
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : msg.type === 'matched-item-card' ? (
                  <div>
                    {msg.content && <div className="mb-2">{msg.content}</div>}
                    <MatchedItemCard
                      item={(msg.payload as { item: Item }).item}
                      onClick={onItemClick}
                      onFind={onFindItem}
                    />
                  </div>
                ) : msg.type === 'quick-entry-confirm' ? (
                  <QuickEntryConfirmCard
                    name={(msg.payload as { name: string }).name}
                    onConfirm={onQuickEntryConfirm}
                    onCancel={onQuickEntryCancel}
                  />
                ) : msg.streaming && !msg.content ? (
                  <TypingDots />
                ) : (
                  <Markdown className="text-sm text-[#2D3436] [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h1]:text-base [&>h1]:font-semibold [&>h2]:text-sm [&>h2]:font-semibold [&_strong]:font-semibold [&_hr]:my-3 [&_hr]:border-[#DFE6E9] [&_code]:bg-[#F5F6FA] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
                    {msg.content}
                  </Markdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex justify-start">
              <div className="flex-shrink-0 mr-2 mt-1">
                <PetAvatar petType={petType ?? DEFAULT_PET} size={20} />
              </div>
              <div className="bg-[#F5F6FA] rounded-2xl rounded-bl-sm px-4 py-2.5">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex gap-2">
              <button
                onClick={onShowWeather}
                className="px-3 py-1.5 text-xs rounded-full bg-[#F5F6FA] text-[#636E72] hover:bg-[#6C5CE710] hover:text-[#6C5CE7] transition-colors flex items-center gap-1"
              >
                <Sun size={12} />
                当日天气
              </button>
              <button
                onClick={onShowSchedule}
                className="px-3 py-1.5 text-xs rounded-full bg-[#F5F6FA] text-[#636E72] hover:bg-[#6C5CE710] hover:text-[#6C5CE7] transition-colors flex items-center gap-1"
              >
                <Calendar size={12} />
                当日日程
              </button>
            </div>
          )}
        </div>

        {/* Input Area (fixed at bottom) */}
        <div className="flex-shrink-0 border-t border-[#DFE6E9] p-3 relative bg-white">
          {/* Search Suggestions Dropdown */}
          {showSuggestions && searchResults.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-[#DFE6E9] shadow-lg max-h-60 overflow-y-auto z-10">
              {searchResults.map((item: Item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemSearchClick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#F5F6FA] transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F5F6FA] overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ItemIcon name={item.name} className="w-full h-full" size={32} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#2D3436] truncate">{item.name}</div>
                    <div className="text-[10px] font-mono text-[#B2BEC3]">{item.deviceId}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

           <div className="flex items-center gap-2">
             <button
               onClick={handleVoiceClick}
               disabled={isRecognizing}
               className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all relative ${
                 isRecording
                   ? 'bg-[#E17055] text-white animate-pulse'
                   : isRecognizing
                   ? 'bg-[#6C5CE7] text-white'
                   : 'bg-[#F5F6FA] text-[#636E72] hover:bg-[#6C5CE710] hover:text-[#6C5CE7]'
               } disabled:opacity-50 disabled:cursor-not-allowed`}
               title={isRecognizing ? '识别中...' : isRecording ? '停止录音' : '语音输入'}
             >
                <Mic size={16} />
                {isRecording && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-[#E17055] opacity-60 animate-ping" />
                    <span className="absolute -top-1 -right-1 text-[10px] bg-[#E17055] text-white px-1 rounded-full min-w-[18px] text-center z-10">
                      {recordingTime}s
                    </span>
                  </>
                )}
             </button>
            <button
              onClick={handlePhotoClick}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#F5F6FA] text-[#636E72] hover:bg-[#6C5CE710] hover:text-[#6C5CE7] flex items-center justify-center transition-colors"
              title="拍照识别"
            >
              <Camera size={16} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(): void => {
                if (inputValue.trim() && searchResults.length > 0) {
                  setShowSuggestions(true);
                }
              }}
               placeholder={isRecording ? '正在聆听…' : '问小寻任何问题...'}
              className="flex-1 h-10 px-4 bg-[#F5F6FA] rounded-full text-sm text-[#2D3436] placeholder:text-[#B2BEC3] outline-none focus:ring-2 focus:ring-[#6C5CE720] transition-shadow"
               disabled={isLoading || isRecognizing}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
      </div>
    </>
  );
};

export default ChatPanel;
