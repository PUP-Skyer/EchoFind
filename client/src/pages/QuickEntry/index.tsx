import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Check, Wifi, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { toast } from 'sonner';
import { echofind } from '@client/src/api';
import type { QuickEntryItem } from '@shared/api.interface';
import type { EchofindVoiceToTextOneOutput } from '@shared/plugin-types';

dayjs.extend(relativeTime);

const POLL_INTERVAL = 5000;
const PENDING_LIMIT = 10;

interface SubmittedRecord {
  id: string;
  name: string;
  submittedAt: string;
}

const QuickEntry: React.FC = () => {
  const [pendingItems, setPendingItems] = useState<QuickEntryItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QuickEntryItem | null>(null);
  const [itemName, setItemName] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [submittedRecords, setSubmittedRecords] = useState<SubmittedRecord[]>([]);
  const [polling, setPolling] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

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
    return (
      window.isSecureContext
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
    );
  };

  const fetchPending = useCallback(async (): Promise<void> => {
    try {
      const response = await echofind.items.quickEntryPending(PENDING_LIMIT);
      setPendingItems(response.items);
      setCurrentItem((prev: QuickEntryItem | null) => {
        if (response.items.length === 0) return null;
        const first = response.items[0];
        // 有更新的贴纸或当前为空时切换
        if (!prev) return first;
        const prevTime = new Date(prev.reportTime).getTime();
        const firstTime = new Date(first.reportTime).getTime();
        if (firstTime > prevTime) return first;
        // 当前项已被录入（不在列表中且有名称），切到第一条
        const stillPending = response.items.some(
          (it: QuickEntryItem) => it.id === prev.id,
        );
        if (!stillPending) return first;
        return prev;
      });
    } catch (err: unknown) {
      logger.error('拉取待录入列表失败', err);
    }
  }, []);

  // 初始加载 + 轮询
  useEffect(() => {
    void fetchPending();
    pollTimerRef.current = window.setInterval(() => {
      void fetchPending();
    }, POLL_INTERVAL);
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchPending]);

  // 轮询状态指示
  useEffect(() => {
    setPolling(true);
    const t = window.setTimeout(() => setPolling(false), 400);
    return () => window.clearTimeout(t);
  }, [pendingItems]);

  const handleVoiceClick = async (): Promise<void> => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    if (
      typeof navigator === 'undefined'
      || !navigator.mediaDevices
      || !navigator.mediaDevices.getUserMedia
    ) {
      toast.error('当前浏览器不支持麦克风录音功能');
      return;
    }

    if (!isSecureContext()) {
      toast.error('录音功能需要 HTTPS 安全环境，请在 HTTPS 页面或 localhost 下使用');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev: number) => prev + 1);
      }, 1000);

      mediaRecorder.onstop = async (): Promise<void> => {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        setIsRecognizing(true);
        try {
          const audioContext = new AudioContext();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBlob = audioContextToWav(audioBuffer);
          const audioFile = new File([wavBlob], 'recording.wav', { type: 'audio/wav' });

          const result = await capabilityClient
            .load('echofind_voice_to_text_1')
            .call<EchofindVoiceToTextOneOutput>('speechToText', {
              audio_url: [audioFile],
              language: 'zh',
            });

          if (result.text && result.text.trim()) {
            setItemName(result.text.trim());
            toast.success('语音识别成功');
          } else {
            toast.warning('未识别到语音内容，请重试');
          }
        } catch (err: unknown) {
          logger.error('语音识别失败', err);
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`语音识别失败: ${msg}`);
        } finally {
          setIsRecognizing(false);
          setRecordingTime(0);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      logger.error('无法访问麦克风', err);
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (name === 'NotAllowedError' || msg.includes('denied') || msg.includes('NotAllowed')) {
        toast.error('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风');
      } else if (name === 'NotFoundError' || msg.includes('NotFound')) {
        toast.error('未检测到麦克风设备，请检查硬件连接');
      } else if (msg.includes('secure') || msg.includes('HTTPS') || msg.includes('secure context')) {
        toast.error('录音功能需要 HTTPS 安全环境');
      } else {
        toast.error(`无法访问麦克风: ${msg}`);
      }
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!currentItem || !itemName.trim() || isSubmitting || isRecognizing) return;

    setIsSubmitting(true);
    try {
      const response = await echofind.items.quickEntrySubmit({
        id: currentItem.id,
        name: itemName.trim(),
        isStored: false,
      });
      if (response.success) {
        toast.success(`已录入：${itemName.trim()} ✓`);
        const submittedId = currentItem.id;
        const submittedName = itemName.trim();
        const record: SubmittedRecord = {
          id: submittedId,
          name: submittedName,
          submittedAt: new Date().toISOString(),
        };
        setSubmittedRecords((prev: SubmittedRecord[]) => [record, ...prev]);
        setItemName('');
        // 从待录入列表移除当前项，切到下一条
        setPendingItems((prev: QuickEntryItem[]) => {
          const remaining = prev.filter(
            (it: QuickEntryItem) => it.id !== submittedId,
          );
          setCurrentItem(remaining.length > 0 ? remaining[0] : null);
          return remaining;
        });
      } else {
        toast.error('录入失败，请重试');
      }
    } catch (err: unknown) {
      logger.error('快速录入提交失败', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`录入失败: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPending = (item: QuickEntryItem): void => {
    setCurrentItem(item);
  };

  const formatTimeAgo = (iso: string): string => {
    return dayjs(iso).fromNow();
  };

  const formatTimeShort = (iso: string): string => {
    return dayjs(iso).format('HH:mm:ss');
  };

  const signalColor = (strength: number): string => {
    if (strength >= 70) return 'text-[#00B894]';
    if (strength >= 40) return 'text-[#FDCB6E]';
    return 'text-[#E17055]';
  };

  const canSubmit = Boolean(currentItem && itemName.trim() && !isSubmitting && !isRecognizing);

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[#2D3436]">快速录入</h1>
        <p className="text-sm text-[#636E72] mt-1">
          贴一张、录一张，流水线作业
        </p>
      </div>

      {/* 两栏布局 */}
      <div className="grid grid-cols-3 gap-5">
        {/* 左侧大卡片 - 录入工作台 */}
        <div className="col-span-2 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] p-6 flex flex-col">
          {/* 顶部区域：当前待录入贴纸 */}
          <div className="mb-8">
            {currentItem ? (
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-[#B2BEC3] mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6C5CE7] animate-pulse" />
                    当前待录入贴纸
                  </div>
                  <div className="text-4xl font-bold text-[#2D3436] font-mono tracking-wide">
                    {currentItem.id}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 ${signalColor(currentItem.signalStrength)}`}>
                    <Wifi size={16} />
                    <span className="text-sm font-medium tabular-nums">
                      {currentItem.signalStrength.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-xs text-[#B2BEC3] mt-1">
                    {formatTimeAgo(currentItem.reportTime)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative mb-3">
                  <span className="w-3 h-3 rounded-full bg-[#B2BEC3] inline-block animate-pulse" />
                  <span className="absolute inset-0 w-3 h-3 rounded-full bg-[#B2BEC3] animate-ping opacity-50" />
                </div>
                <div className="text-sm text-[#B2BEC3]">请贴一个贴纸…等待信号中</div>
              </div>
            )}
          </div>

          {/* 中间大麦克风按钮 */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              {/* 录音波纹 */}
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full bg-[#E17055] opacity-30 animate-ping" />
                  <span
                    className="absolute inset-0 rounded-full bg-[#E17055] opacity-20 animate-ping"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              <button
                onClick={handleVoiceClick}
                disabled={isRecognizing}
                className={`relative w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                  isRecording
                    ? 'bg-[#E17055] text-white scale-105'
                    : isRecognizing
                    ? 'bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] text-white'
                    : 'bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] text-white hover:scale-105 hover:shadow-xl active:scale-95'
                } disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100`}
                title={
                  isRecognizing ? '识别中…' : isRecording ? '停止录音' : '按住说话'
                }
              >
                {isRecognizing ? (
                  <Loader2 size={48} className="animate-spin" />
                ) : (
                  <Mic size={48} />
                )}
              </button>
            </div>
            <div className="mt-4 text-sm text-[#636E72]">
              {isRecording
                ? '正在录音…'
                : isRecognizing
                ? '识别中…'
                : '点击开始说话'}
            </div>
            {isRecording && (
              <div className="mt-1 text-xs text-[#E17055] tabular-nums font-medium">
                {recordingTime}s
              </div>
            )}
          </div>

          {/* 物品名称输入区 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#2D3436] mb-2">
              物品名称
            </label>
            <div className="relative">
              <input
                type="text"
                value={itemName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setItemName(e.target.value)
                }
                placeholder="请输入或语音识别物品名称"
                className="w-full h-14 px-4 text-xl bg-[#F5F6FA] rounded-xl text-[#2D3436] placeholder:text-[#B2BEC3] outline-none border-2 border-transparent focus:border-[#6C5CE7] focus:bg-white transition-all"
                disabled={isSubmitting}
              />
              {isRecording && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E17055] text-sm font-medium tabular-nums flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E17055] animate-pulse" />
                  {recordingTime}s
                </div>
              )}
            </div>
          </div>

          {/* 底部确认录入按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full h-14 rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-[#DFE6E9] text-[#B2BEC3] cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                提交中…
              </>
            ) : (
              <>
                <Check size={20} />
                确认录入
              </>
            )}
          </button>
        </div>

        {/* 右侧卡片 - 本次录入流水 */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2D3436]">本次录入流水</h2>
            <span className="px-2 py-0.5 bg-[#6C5CE7] text-white text-xs rounded-full font-medium">
              {submittedRecords.length}
            </span>
          </div>

          {/* 已录入列表 */}
          <div className="flex-1 overflow-y-auto min-h-0 mb-4">
            {submittedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#B2BEC3]">
                <Check size={32} className="mb-2 opacity-30" />
                <div className="text-sm">还没有录入记录</div>
              </div>
            ) : (
              <div className="space-y-2">
                {submittedRecords.map((record: SubmittedRecord) => (
                  <div
                    key={record.id + record.submittedAt}
                    className="p-3 rounded-xl hover:bg-[#F5F6FA] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00B894] flex items-center justify-center mt-0.5">
                        <Check size={12} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#2D3436] truncate">
                          {record.name}
                        </div>
                        <div className="text-xs text-[#B2BEC3] font-mono mt-0.5">
                          {record.id}
                        </div>
                        <div className="text-xs text-[#B2BEC3] mt-0.5">
                          {formatTimeShort(record.submittedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="border-t border-[#DFE6E9] pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#2D3436]">
                待录入队列
              </span>
              <span className="text-xs text-[#B2BEC3] flex items-center gap-1">
                {polling && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C5CE7] animate-pulse" />
                )}
                {pendingItems.length} 个
              </span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {pendingItems.length === 0 ? (
                <div className="text-xs text-[#B2BEC3] text-center py-4">
                  暂无待录入贴纸
                </div>
              ) : (
                pendingItems.map((item: QuickEntryItem) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPending(item)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                      currentItem?.id === item.id
                        ? 'bg-[#6C5CE710] border border-[#6C5CE730]'
                        : 'hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <span
                      className={`text-sm font-mono ${
                        currentItem?.id === item.id
                          ? 'text-[#6C5CE7] font-medium'
                          : 'text-[#636E72]'
                      }`}
                    >
                      {item.id}
                    </span>
                    <span
                      className={`text-xs tabular-nums ${signalColor(item.signalStrength)}`}
                    >
                      {item.signalStrength.toFixed(0)}%
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickEntry;
