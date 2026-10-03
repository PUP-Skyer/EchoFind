import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Wifi,
  AlertTriangle,
  RefreshCw,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import type { EchofindXiaoxunSpeechBroadcastOneOutput } from '@shared/plugin-types';
import { echofind } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { toast } from 'sonner';

const TTS_PLUGIN_ID = 'echofind_xiaoxun_speech_broadcast_1';

type DistanceLevel = 'far' | 'nearby' | 'close' | 'here';
type Trend = 'getting_closer' | 'getting_farther' | 'stable' | 'unknown';

interface RssiHistory {
  samples: number[];
  averaged: number[];
}

const SAMPLE_WINDOW = 10;
const AVERAGE_WINDOW = 8;

function distanceLevel(rssi: number): DistanceLevel {
  if (rssi > -50) return 'here';
  if (rssi >= -65) return 'close';
  if (rssi >= -80) return 'nearby';
  return 'far';
}

function levelFill(level: DistanceLevel): number {
  switch (level) {
    case 'here': return 100;
    case 'close': return 75;
    case 'nearby': return 50;
    case 'far': return 20;
  }
}

function levelText(level: DistanceLevel): string {
  switch (level) {
    case 'here': return '就在这了';
    case 'close': return '很近';
    case 'nearby': return '附近';
    case 'far': return '很远';
  }
}

function levelColor(level: DistanceLevel): string {
  switch (level) {
    case 'here': return '#00B894';
    case 'close': return '#6C5CE7';
    case 'nearby': return '#FDCB6E';
    case 'far': return '#B2BEC3';
  }
}

function computeTrend(averaged: number[]): Trend {
  if (averaged.length < 4) return 'unknown';
  const half = Math.floor(averaged.length / 2);
  const first = averaged.slice(0, half);
  const second = averaged.slice(-half);
  const firstAvg = first.reduce((a: number, b: number) => a + b, 0) / first.length;
  const secondAvg = second.reduce((a: number, b: number) => a + b, 0) / second.length;
  const diff = secondAvg - firstAvg;
  if (diff > 2) return 'getting_closer';
  if (diff < -2) return 'getting_farther';
  return 'stable';
}

function buildGuideText(level: DistanceLevel, trend: Trend): string {
  if (level === 'here') {
    return '就在这附近啦，仔细看看周围～';
  }
  if (trend === 'getting_closer') {
    return '在靠近，继续这个方向走';
  }
  if (trend === 'getting_farther') {
    return '走反了，掉头试试';
  }
  if (trend === 'stable') {
    if (level === 'close') return '离得很近了，慢慢移动找一下';
    if (level === 'nearby') return '在附近，试着左右转转';
    return '还很远，先朝大致方向走走看';
  }
  return '正在探测信号...';
}

const FindGuidePage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [itemName, setItemName] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [bleSupported, setBleSupported] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [rssiHistory, setRssiHistory] = useState<RssiHistory>({ samples: [], averaged: [] });
  const [lastRssi, setLastRssi] = useState<number | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const lastTtsTimeRef = useRef<number>(0);
  const lastLevelRef = useRef<DistanceLevel | null>(null);
  const lastTrendRef = useRef<Trend>('unknown');
  const signalReportTimerRef = useRef<number | null>(null);
  const pendingSignalRef = useRef<number | null>(null);

  const currentAvg = rssiHistory.averaged.length > 0
    ? rssiHistory.averaged[rssiHistory.averaged.length - 1]
    : null;
  const currentLevel = currentAvg !== null ? distanceLevel(currentAvg) : null;
  const currentTrend = computeTrend(rssiHistory.averaged);
  const guideText = currentLevel !== null ? buildGuideText(currentLevel, currentTrend) : '等待信号...';

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      setBleSupported(false);
    }
  }, []);

  useEffect(() => {
    const loadItem = async (): Promise<void> => {
      if (!itemId) {
        setLoading(false);
        return;
      }
      try {
        const item = await echofind.items.get(itemId);
        setItemName(item.name);
        setDeviceId(item.deviceId);
      } catch (err: unknown) {
        logger.error('加载物品失败', err);
        toast.error('找不到该物品');
      } finally {
        setLoading(false);
      }
    };
    void loadItem();

    const loadPetProfile = async (): Promise<void> => {
      try {
        const profile = await echofind.pet.getProfile();
        setTtsEnabled(profile.ttsEnabled);
      } catch (err: unknown) {
        logger.error('加载宠物配置失败', err);
      }
    };
    void loadPetProfile();
  }, [itemId]);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!ttsEnabled) return;
    const now = Date.now();
    if (now - lastTtsTimeRef.current < 4000) return;
    lastTtsTimeRef.current = now;
    try {
      const result = await capabilityClient
        .load(TTS_PLUGIN_ID)
        .call<EchofindXiaoxunSpeechBroadcastOneOutput>('speechSynthesis', {
          item_info: '',
          item_location: text,
        });
      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        void audio.play();
      }
    } catch (err: unknown) {
      logger.error('语音播报失败', err);
    }
  }, [ttsEnabled]);

  const reportSignalToBackend = useCallback(async (): Promise<void> => {
    if (!itemId || pendingSignalRef.current == null) return;
    const strength = Math.max(0, Math.min(100, Math.round(((pendingSignalRef.current + 100) / 50) * 100)));
    pendingSignalRef.current = null;
    try {
      await echofind.items.update(itemId, { signalStrength: strength });
    } catch (err: unknown) {
      logger.error('上报信号失败', err);
    }
  }, [itemId]);

  const handleRssiSample = useCallback((rssi: number) => {
    setRssiHistory((prev: RssiHistory) => {
      const newSamples = [...prev.samples, rssi].slice(-SAMPLE_WINDOW);
      const avg = newSamples.reduce((a: number, b: number) => a + b, 0) / newSamples.length;
      const newAveraged = [...prev.averaged, avg].slice(-AVERAGE_WINDOW);
      return { samples: newSamples, averaged: newAveraged };
    });
    setLastRssi(rssi);
    pendingSignalRef.current = rssi;
  }, []);

  useEffect(() => {
    if (currentLevel && currentLevel !== lastLevelRef.current) {
      lastLevelRef.current = currentLevel;
      void speak(`${itemName}${levelText(currentLevel)}了`);
    } else if (currentTrend !== lastTrendRef.current && currentTrend !== 'unknown' && currentTrend !== 'stable') {
      lastTrendRef.current = currentTrend;
      if (currentTrend === 'getting_closer') {
        void speak('靠近了，继续');
      } else if (currentTrend === 'getting_farther') {
        void speak('走反了，掉头');
      }
    }
  }, [currentLevel, currentTrend, itemName, speak]);

  useEffect(() => {
    if (isScanning && itemId) {
      signalReportTimerRef.current = window.setInterval(() => {
        void reportSignalToBackend();
      }, 3000);
    }
    return () => {
      if (signalReportTimerRef.current !== null) {
        clearInterval(signalReportTimerRef.current);
        signalReportTimerRef.current = null;
      }
    };
  }, [isScanning, itemId, reportSignalToBackend]);

  const startScan = async (): Promise<void> => {
    setScanError(null);
    try {
      if (!navigator.bluetooth) {
        setScanError('当前浏览器不支持 Web Bluetooth');
        return;
      }
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access'],
      });
      deviceRef.current = device;

      if (!device.watchAdvertisements) {
        setScanError('此浏览器不支持广播监听');
        return;
      }

      device.addEventListener('advertisementreceived', (event: Event) => {
        const advEvent = event as BluetoothAdvertisingEvent;
        if (advEvent.rssi != null && typeof advEvent.rssi === 'number') {
          handleRssiSample(advEvent.rssi);
        }
      });

      await device.watchAdvertisements();
      setIsScanning(true);
      void speak(`开始寻找${itemName}，慢慢走动看看信号变化`);
    } catch (err: unknown) {
      logger.error('BLE 扫描失败', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User cancelled') || msg.includes('canceled')) {
        setScanError('已取消选择设备');
      } else if (msg.includes('SecurityError') || location.protocol !== 'https:') {
        setScanError('请在 HTTPS 环境下使用此功能（Android Chrome/Edge）');
      } else {
        setScanError(`扫描失败：${msg}`);
      }
    }
  };

  const stopScan = (): void => {
    if (deviceRef.current) {
      try {
        if (typeof deviceRef.current.watchAdvertisements === 'function' &&
            typeof (deviceRef.current as any).unwatchAdvertisements === 'function') {
          (deviceRef.current as any).unwatchAdvertisements();
        }
      } catch (err: unknown) {
        logger.error('停止扫描出错', err);
      }
    }
    setIsScanning(false);
  };

  const handleBack = (): void => {
    stopScan();
    navigate(-1);
  };

  const circleSize = 260;
  const strokeWidth = 16;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPct = currentLevel !== null ? levelFill(currentLevel) : 0;
  const offset = circumference - (fillPct / 100) * circumference;
  const color = currentLevel !== null ? levelColor(currentLevel) : '#DFE6E9';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#6C5CE7]/5 via-[#F5F6FA] to-[#F5F6FA] flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center gap-3 px-4 h-14 bg-white/80 backdrop-blur-sm border-b border-[#DFE6E9]">
        <Button variant="outline" size="sm" onClick={handleBack} className="border-0 hover:bg-[#F5F6FA]">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#2D3436] truncate">
            寻找：{itemName || '加载中...'}
          </div>
          <div className="text-xs text-[#B2BEC3] truncate">
            {deviceId || '贴纸编号加载中...'}
          </div>
        </div>
        <button
          type="button"
          onClick={(): void => setTtsEnabled(!ttsEnabled)}
          className="p-2 rounded-lg hover:bg-[#F5F6FA] transition-colors"
          title={ttsEnabled ? '语音播报开启' : '语音播报关闭'}
        >
          {ttsEnabled ? (
            <Volume2 size={18} className="text-[#6C5CE7]" />
          ) : (
            <VolumeX size={18} className="text-[#B2BEC3]" />
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#6C5CE7]" />
            <p className="text-sm text-[#636E72]">加载物品信息中...</p>
          </div>
        ) : !bleSupported ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-[#E17055]/10 flex items-center justify-center">
              <AlertTriangle size={28} className="text-[#E17055]" />
            </div>
            <h3 className="text-lg font-semibold text-[#2D3436]">浏览器不支持</h3>
            <p className="text-sm text-[#636E72] leading-relaxed">
              请用 Android 手机 Chrome / Edge 浏览器，
              在 HTTPS 线上链接打开此功能。
            </p>
            <Button onClick={handleBack} className="mt-2">返回</Button>
          </div>
        ) : !isScanning ? (
          <div className="flex flex-col items-center gap-6 text-center max-w-xs">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center shadow-lg shadow-[#6C5CE7]/20">
              <Wifi size={40} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#2D3436] mb-2">
                开始寻找「{itemName}」
              </h3>
              <p className="text-sm text-[#636E72] leading-relaxed">
                点击下方按钮，在弹出的蓝牙设备列表中选择目标贴纸设备，
                小寻会根据信号强度语音引导你找到它。
              </p>
            </div>
            {scanError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E17055]/10 text-[#E17055] text-sm w-full">
                <XCircle size={16} />
                <span className="flex-1 text-left">{scanError}</span>
              </div>
            )}
            <Button
              onClick={(): Promise<void> => startScan()}
              className="w-full h-12 text-base bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] shadow-lg shadow-[#6C5CE7]/20 hover:shadow-xl hover:shadow-[#6C5CE7]/30"
            >
              <Wifi className="mr-2 h-5 w-5" />
              开始寻找
            </Button>
          </div>
        ) : (
          <>
            {/* Signal Ring */}
            <div className="relative" style={{ width: circleSize, height: circleSize }}>
              <svg width={circleSize} height={circleSize} className="-rotate-90">
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="none"
                  stroke="#DFE6E9"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-500"
                  style={{ filter: `drop-shadow(0 0 12px ${color}60)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="text-3xl font-bold transition-colors duration-300"
                  style={{ color }}
                >
                  {currentLevel !== null ? levelText(currentLevel) : '...'}
                </div>
                <div className="text-sm text-[#B2BEC3] mt-1 font-mono">
                  {lastRssi !== null ? `${lastRssi.toFixed(0)} dBm` : '--'}
                </div>
              </div>
            </div>

            {/* Guide Text */}
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-[#2D3436]">{guideText}</p>
              <div className="flex items-center justify-center gap-4 text-xs text-[#B2BEC3]">
                <span className="flex items-center gap-1">
                  {currentTrend === 'getting_closer' && (
                    <><CheckCircle2 size={12} className="text-[#00B894]" /> 信号变强</>
                  )}
                  {currentTrend === 'getting_farther' && (
                    <><XCircle size={12} className="text-[#E17055]" /> 信号变弱</>
                  )}
                  {currentTrend === 'stable' && (
                    <><span className="w-3 h-0.5 bg-[#FDCB6E] rounded-full" /> 信号稳定</>
                  )}
                  {currentTrend === 'unknown' && '正在分析...'}
                </span>
              </div>
            </div>

            {/* Tips */}
            <div className="w-full max-w-xs p-4 rounded-2xl bg-white/80 border border-[#DFE6E9]">
              <p className="text-xs text-[#636E72] leading-relaxed">
                💡 <span className="font-medium text-[#2D3436]">小提示：</span>
                慢慢走动，观察圆环变化。圆环越满、颜色越绿，说明离物品越近。
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                onClick={(): void => { stopScan(); void startScan(); }}
                className="flex-1 h-11"
              >
                <RefreshCw size={16} className="mr-1.5" />
                重新扫描
              </Button>
              <Button
                onClick={(): void => stopScan()}
                className="flex-1 h-11 bg-[#E17055] hover:bg-[#D63031]"
              >
                结束寻找
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FindGuidePage;
