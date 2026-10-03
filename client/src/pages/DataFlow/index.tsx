import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { GraphicComponent } from 'echarts/components';
import dayjs from 'dayjs';
import {
  Radio,
  Cloud,
  Database,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Activity,
  Clock,
  Gauge,
  FileText,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { stats as echofindStats } from '@client/src/api/echofind';
import { usePoll } from '@client/src/hooks/use-poll';
import type {
  DataFlowStatus,
  ReportRecord,
  SignalDistribution,
  TrendDataPoint,
} from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Image } from '@client/src/components/ui/image';
import ItemIcon from '@client/src/components/ui/item-icon';
import { toast } from 'sonner';

echarts.use([GraphicComponent]);

const PRIMARY = '#6C5CE7';
const PRIMARY_LIGHT = '#A29BFE';
const SUCCESS = '#00B894';
const WARNING = '#FDCB6E';
const DANGER = '#E17055';
const MUTED = '#B2BEC3';

function getSignalLevel(strength: number): {
  label: string;
  color: string;
  icon: typeof Wifi;
} {
  if (strength >= 80) return { label: '强', color: SUCCESS, icon: Wifi };
  if (strength >= 50) return { label: '中', color: WARNING, icon: Wifi };
  if (strength >= 20) return { label: '弱', color: DANGER, icon: Wifi };
  return { label: '极弱', color: '#E17055', icon: WifiOff };
}

const signalBarColor = (range: string): string => {
  if (range.includes('80') || range.includes('强')) return SUCCESS;
  if (range.includes('50') || range.includes('中')) return WARNING;
  if (range.includes('20') || range.includes('弱')) return DANGER;
  return '#E17055';
};

const signalLabel = (range: string): string => {
  if (range.includes('80') || range.includes('强')) return '强 (80-100)';
  if (range.includes('50') || range.includes('中')) return '中 (50-79)';
  if (range.includes('20') || range.includes('弱')) return '弱 (20-49)';
  return '极弱 (0-19)';
};

const DataFlow: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dataflow, setDataflow] = useState<DataFlowStatus | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [signalDist, setSignalDist] = useState<SignalDistribution[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchAll = async (): Promise<void> => {
    try {
      const [df, rep, tr, sd] = await Promise.all([
        echofindStats.dataflow(),
        echofindStats.recentReports(20),
        echofindStats.trend(7),
        echofindStats.signalDistribution(),
      ]);
      setDataflow(df);
      setReports(rep);
      setTrend(tr);
      setSignalDist(sd);
    } catch (err: unknown) {
      logger.error('DataFlow 数据加载失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  usePoll(
    async (): Promise<void> => {
      if (loading) return;
      await fetchAll();
    },
    [],
    { intervalMs: 6000 },
  );

  const handleRefresh = (): void => {
    setRefreshing(true);
    void fetchAll().finally(() => setRefreshing(false));
  };

  const trendOption = useMemo<EChartsOption>(() => {
    const dates = trend.map((t: TrendDataPoint) => t.date);
    const counts = trend.map((t: TrendDataPoint) => t.count);
    return {
      tooltip: { trigger: 'axis' },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#DFE6E9' } },
        axisTick: { show: false },
        axisLabel: { color: '#636E72', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F0F2F5' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#B2BEC3', fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          data: counts,
          barWidth: 24,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: PRIMARY },
              { offset: 1, color: PRIMARY_LIGHT },
            ]),
          },
        },
      ],
    };
  }, [trend]);

  const signalMax = useMemo(
    () => Math.max(1, ...signalDist.map((s: SignalDistribution) => s.count)),
    [signalDist],
  );

  if (loading || !dataflow) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-[#2D3436]">数据流</h1>
        <p className="text-sm text-[#636E72] mt-1">
          实时监控 ESP32 与飞书多维表格的数据传输链路
        </p>
        <div className="mt-6 bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <div className="inline-block w-8 h-8 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[#B2BEC3]">数据加载中...</p>
        </div>
      </div>
    );
  }

  const espConnected = dataflow.esp32Status === 'connected';
  const feishuConnected = dataflow.feishuStatus === 'connected';
  const allConnected = espConnected && feishuConnected;

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436]">数据流</h1>
          <p className="text-sm text-[#636E72] mt-1">
            实时监控 ESP32 贴纸 → 飞书多维表格的数据传输链路
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-1.5"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          刷新
        </Button>
      </div>

      {/* 两栏布局 */}
      <div className="flex gap-5 mt-6">
        {/* 左侧主区 */}
        <div className="flex-1 flex flex-col gap-5">
          {/* 1. 链路可视化卡片 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[#2D3436]">
                  数据传输链路
                </h2>
                <p className="text-sm text-[#636E72] mt-0.5">
                  ESP32 贴纸 → 飞书多维表格
                </p>
              </div>
            </div>

            {/* 链路节点 */}
            <div className="relative flex items-center justify-between px-8 py-6">
              {/* ESP32 节点 */}
              <div className="flex flex-col items-center z-10">
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      espConnected
                        ? 'bg-[#00B894]/10'
                        : 'bg-[#B2BEC3]/10'
                    }`}
                  >
                    <Radio
                      className={`w-7 h-7 ${
                        espConnected
                          ? 'text-[#00B894]'
                          : 'text-[#B2BEC3]'
                      }`}
                    />
                  </div>
                  {/* 呼吸状态灯 */}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      espConnected
                        ? 'bg-[#00B894] echo-pulse-green'
                        : 'bg-[#B2BEC3]'
                    }`}
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-[#2D3436]">
                  ESP32 贴纸
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    espConnected ? 'text-[#00B894]' : 'text-[#B2BEC3]'
                  }`}
                >
                  {espConnected ? '在线' : '离线'}
                </p>
              </div>

              {/* 连接线 1 */}
              <div className="flex-1 mx-2 relative">
                <div
                  className={`h-0.5 border-t-2 border-dashed ${
                    espConnected && feishuConnected
                      ? 'border-[#00B894]'
                      : 'border-[#DFE6E9]'
                  }`}
                />
                {allConnected && (
                  <div className="echo-flow-dot echo-flow-1" />
                )}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-[#636E72] whitespace-nowrap">
                  延迟 {dataflow.latency}ms
                </div>
              </div>

              {/* 飞书 API 节点 */}
              <div className="flex flex-col items-center z-10">
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      feishuConnected
                        ? 'bg-[#00B894]/10'
                        : 'bg-[#B2BEC3]/10'
                    }`}
                  >
                    <Cloud
                      className={`w-7 h-7 ${
                        feishuConnected
                          ? 'text-[#00B894]'
                          : 'text-[#B2BEC3]'
                      }`}
                    />
                  </div>
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      feishuConnected
                        ? 'bg-[#00B894] echo-pulse-green'
                        : 'bg-[#B2BEC3]'
                    }`}
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-[#2D3436]">
                  飞书 API
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    feishuConnected
                      ? 'text-[#00B894]'
                      : 'text-[#B2BEC3]'
                  }`}
                >
                  {feishuConnected ? '正常' : '断开'}
                </p>
              </div>

              {/* 连接线 2 */}
              <div className="flex-1 mx-2 relative">
                <div
                  className={`h-0.5 border-t-2 border-dashed ${
                    feishuConnected
                      ? 'border-[#00B894]'
                      : 'border-[#DFE6E9]'
                  }`}
                />
                {allConnected && (
                  <div className="echo-flow-dot echo-flow-2" />
                )}
              </div>

              {/* 多维表格节点 */}
              <div className="flex flex-col items-center z-10">
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      feishuConnected
                        ? 'bg-[#6C5CE7]/10'
                        : 'bg-[#B2BEC3]/10'
                    }`}
                  >
                    <Database
                      className={`w-7 h-7 ${
                        feishuConnected
                          ? 'text-[#6C5CE7]'
                          : 'text-[#B2BEC3]'
                      }`}
                    />
                  </div>
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      feishuConnected
                        ? 'bg-[#6C5CE7] echo-pulse-purple'
                        : 'bg-[#B2BEC3]'
                    }`}
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-[#2D3436]">
                  多维表格
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    feishuConnected
                      ? 'text-[#6C5CE7]'
                      : 'text-[#B2BEC3]'
                  }`}
                >
                  {feishuConnected ? '同步中' : '未连接'}
                </p>
              </div>
            </div>

            {/* 底部信息 */}
            <div className="flex items-center justify-center gap-8 mt-8 pt-4 border-t border-[#F0F2F5]">
              <div className="flex items-center gap-2 text-sm text-[#636E72]">
                <Gauge className="w-4 h-4 text-[#6C5CE7]" />
                <span>
                  端到端延迟：
                  <span className="font-semibold text-[#2D3436]">
                    {dataflow.latency}ms
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#636E72]">
                <Clock className="w-4 h-4 text-[#6C5CE7]" />
                <span>
                  最近同步：
                  <span className="font-semibold text-[#2D3436]">
                    {dayjs(dataflow.lastSyncTime).format('HH:mm:ss')}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* 2. 实时上报流卡片 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#6C5CE7]" />
                <h2 className="text-lg font-semibold text-[#2D3436]">
                  实时上报流
                </h2>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00B894]/10 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#00B894] echo-blink" />
                <span className="text-xs font-semibold text-[#00B894] tracking-wider">
                  LIVE
                </span>
              </div>
            </div>

            <div
              ref={listRef}
              className="h-[400px] overflow-y-auto pr-1 -mr-1 space-y-2 scrollbar-thin"
            >
              <AnimatePresence initial={false}>
                {reports.slice(0, 10).map((report: ReportRecord) => {
                  const sig = getSignalLevel(report.signalStrength);
                  const SigIcon = sig.icon;
                  return (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: -12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: 'easeOut',
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F5F6FA] transition-colors"
                    >
                      {/* 时间 */}
                      <span className="text-xs text-[#B2BEC3] w-14 shrink-0 font-mono">
                        {dayjs(report.timestamp).format('HH:mm:ss')}
                      </span>

                      {/* 缩略图 */}
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#F0F2F5]">
                        {report.imageUrl ? (
                          <Image
                            src={report.imageUrl}
                            alt={report.itemName}
                            className="w-full h-full object-cover"
                            width={32}
                            height={32}
                          />
                        ) : (
                          <ItemIcon name={report.itemName} className="w-full h-full" size={32} />
                        )}
                      </div>

                      {/* 主信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-[#2D3436]">
                            {report.deviceId}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0 h-5 border-[#DFE6E9] text-[#636E72]"
                          >
                            {report.isStored ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-[#00B894] mr-0.5" />
                                已存入
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-[#B2BEC3] mr-0.5" />
                                未存入
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#636E72] truncate mt-0.5">
                          {report.itemName}
                        </p>
                      </div>

                      {/* 信号强度 */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        style={{ color: sig.color }}
                      >
                        <SigIcon className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                          {report.signalStrength}
                        </span>
                        <span className="text-xs opacity-80">{sig.label}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* 3. 上报趋势柱状图 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6C5CE7]" />
                <h2 className="text-lg font-semibold text-[#2D3436]">
                  近 7 天上报趋势
                </h2>
              </div>
            </div>
            <ReactECharts
              option={trendOption}
              theme="ud"
              className="h-[280px] w-full"
            />
          </div>
        </div>

        {/* 右侧面板 */}
        <div className="w-80 flex flex-col gap-5 shrink-0">
          {/* 1. 同步状态卡片 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h2 className="text-base font-semibold text-[#2D3436] mb-4">
              同步状态
            </h2>

            <div className="space-y-4">
              {/* 飞书连接 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    feishuConnected
                      ? 'bg-[#00B894]/10'
                      : 'bg-[#E17055]/10'
                  }`}
                >
                  {feishuConnected ? (
                    <CheckCircle2
                      className="w-5 h-5 text-[#00B894]"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <XCircle
                      className="w-5 h-5 text-[#E17055]"
                      strokeWidth={2.5}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2D3436]">
                    飞书连接
                  </p>
                  <p
                    className={`text-xs ${
                      feishuConnected
                        ? 'text-[#00B894]'
                        : 'text-[#E17055]'
                    }`}
                  >
                    {feishuConnected ? '已连接' : '连接失败'}
                  </p>
                </div>
              </div>

              {/* token 状态 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00B894]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#00B894]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2D3436]">
                    tenant_access_token
                  </p>
                  <p className="text-xs text-[#00B894]">有效</p>
                </div>
              </div>

              <div className="border-t border-[#F0F2F5] pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#636E72]">最近同步</span>
                  <span className="text-[#2D3436] font-medium">
                    {dayjs(dataflow.lastSyncTime).format('HH:mm:ss')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#636E72]">今日上报</span>
                  <span className="text-[#2D3436] font-semibold text-[#6C5CE7]">
                    {dataflow.todayReports} 条
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#636E72]">平均延迟</span>
                  <span className="text-[#2D3436] font-medium">
                    {dataflow.latency}ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 信号强度分布卡片 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h2 className="text-base font-semibold text-[#2D3436] mb-4">
              信号强度分布
            </h2>
            <div className="space-y-3.5">
              {signalDist.map((item: SignalDistribution) => {
                const color = signalBarColor(item.range);
                const label = signalLabel(item.range);
                const widthPct = (item.count / signalMax) * 100;
                return (
                  <div key={item.range}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#636E72]">{label}</span>
                      <span
                        className="font-semibold"
                        style={{ color }}
                      >
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F0F2F5] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 快捷操作卡片 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h2 className="text-base font-semibold text-[#2D3436] mb-4">
              调试工具
            </h2>
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleRefresh}
                className="w-full gap-1.5"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                />
                刷新数据流
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 自定义动画样式 */}
      <style>{`
        @keyframes pulse-green {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.6);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(0, 184, 148, 0);
          }
        }
        @keyframes pulse-purple {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(108, 92, 231, 0.6);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(108, 92, 231, 0);
          }
        }
        .echo-pulse-green {
          animation: pulse-green 2s ease-in-out infinite;
        }
        .echo-pulse-purple {
          animation: pulse-purple 2s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .echo-blink {
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes flow-dot-1 {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes flow-dot-2 {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .echo-flow-dot {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #00B894;
          box-shadow: 0 0 8px rgba(0, 184, 148, 0.8);
        }
        .echo-flow-1 {
          animation: flow-dot-1 2.5s linear infinite;
        }
        .echo-flow-2 {
          animation: flow-dot-2 2.5s linear infinite;
          animation-delay: 1.2s;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #DFE6E9;
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #B2BEC3;
        }
      `}</style>
    </div>
  );
};

export default DataFlow;
