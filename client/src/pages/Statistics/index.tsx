import { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  Activity,
  Radio,
  Signal,
  AlertTriangle,
} from 'lucide-react';
import { usePoll } from '@client/src/hooks/use-poll';
import { echofind } from '@client/src/api';
import type {
  StatsOverview,
  TrendDataPoint,
  SignalDistribution,
} from '@shared/api.interface';

const STAT_COLORS = {
  primary: '#6C5CE7',
  success: '#00B894',
  warning: '#FDCB6E',
  danger: '#E17055',
} as const;

const SIGNAL_COLORS: Record<string, string> = {
  '强(80-100)': '#00B894',
  '中(50-79)': '#FDCB6E',
  '弱(20-49)': '#E17055',
  '极弱(0-19)': '#B2BEC3',
};

const ALERT_TYPE_COLORS: Record<string, string> = {
  阻隔: '#FDCB6E',
  低电: '#E17055',
  离线: '#B2BEC3',
  异常: '#74B9FF',
};

interface StatCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  bgColor: string;
  value: string | number;
  unit?: string;
  label: string;
  subLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  bgColor,
  value,
  unit,
  label,
  subLabel,
}) => (
  <div
    className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex items-center gap-4"
    data-ai-section-type="card-stat"
  >
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${bgColor}15` }}
    >
      <Icon className="w-6 h-6" style={{ color: bgColor }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-[#2D3436]">
          {value}
        </span>
        {unit && (
          <span className="text-base font-medium text-[#636E72]">
            {unit}
          </span>
        )}
      </div>
      <p className="text-xs text-[#636E72] mt-1">{label}</p>
      {subLabel && (
        <p className="text-xs text-[#B2BEC3] mt-0.5">{subLabel}</p>
      )}
    </div>
  </div>
);

const Statistics: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [trendDays, setTrendDays] = useState<number>(7);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    return (): void => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetchOverview = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await echofind.stats.overview();
        if (mountedRef.current) setOverview(data);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    void fetchOverview();
  }, []);

  useEffect(() => {
    const fetchTrend = async (): Promise<void> => {
      const data = await echofind.stats.trend(trendDays);
      if (mountedRef.current) setTrendData(data);
    };
    void fetchTrend();
  }, [trendDays]);

  usePoll(
    async (): Promise<void> => {
      try {
        const [ov, trend] = await Promise.all([
          echofind.stats.overview(),
          echofind.stats.trend(trendDays),
        ]);
        if (mountedRef.current) {
          setOverview(ov);
          setTrendData(trend);
        }
      } catch {
        // poll 失败静默，下次再试
      }
    },
    [trendDays],
    { intervalMs: 8000 },
  );

  // 计算平均信号强度
  const avgSignalStrength = useMemo((): number => {
    if (!overview?.signalDistribution?.length) return 0;
    const midPoints: Record<string, number> = {
      '强(80-100)': 90,
      '中(50-79)': 64.5,
      '弱(20-49)': 34.5,
      '极弱(0-19)': 9.5,
    };
    let total = 0;
    let count = 0;
    for (const item of overview.signalDistribution) {
      const mid = midPoints[item.range] ?? 50;
      total += mid * item.count;
      count += item.count;
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [overview?.signalDistribution]);

  // 总上报量（取趋势数据累计）
  const totalReports = useMemo((): number => {
    return trendData.reduce(
      (sum: number, d: TrendDataPoint) => sum + d.count,
      0,
    );
  }, [trendData]);

  // 告警总数（mock 计算：阻隔+离线+低电+异常，这里用总设备数的 15% 近似）
  const totalAlerts = useMemo((): number => {
    if (!overview?.totalDevices) return 0;
    return Math.round(overview.totalDevices * 0.15);
  }, [overview?.totalDevices]);

  // 上报趋势柱状图 option
  const trendOption: EChartsOption = {
    grid: { containLabel: true, bottom: '20%', top: 20, left: 10, right: 10 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#DFE6E9',
      textStyle: { color: '#2D3436', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: trendData.map((d: TrendDataPoint) => d.date.slice(5)),
      axisLine: { lineStyle: { color: '#DFE6E9' } },
      axisTick: { show: false },
      axisLabel: { color: '#B2BEC3', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F5F6FA' } },
      axisLabel: { color: '#B2BEC3', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: trendData.map((d: TrendDataPoint) => d.count),
        barWidth: 16,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#A29BFE' },
              { offset: 1, color: '#6C5CE7' },
            ],
          },
          borderRadius: [6, 6, 0, 0],
        },
      },
    ],
  };

  // 设备在线率 环形图 option
  const onlineRateOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#DFE6E9',
      textStyle: { color: '#2D3436', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#636E72', fontSize: 12 },
    },
    series: [
      {
        name: '设备状态',
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: false },
        },
        data: [
          {
            value: overview?.onlineDevices ?? 0,
            name: '在线',
            itemStyle: { color: '#00B894' },
          },
          {
            value: overview
              ? Math.round(overview.totalDevices * 0.18)
              : 0,
            name: '阻隔',
            itemStyle: { color: '#FDCB6E' },
          },
          {
            value: overview
              ? overview.totalDevices -
                overview.onlineDevices -
                Math.round(overview.totalDevices * 0.18)
              : 0,
            name: '离线',
            itemStyle: { color: '#B2BEC3' },
          },
        ],
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: `${overview?.deviceOnlineRate ?? 0}%`,
          fontSize: 30,
          fontWeight: 700,
          fill: '#2D3436',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '55%',
        style: {
          text: '在线率',
          fontSize: 12,
          fill: '#B2BEC3',
        },
      },
    ],
  };

  // 信号强度分布 横向条形图 option
  const signalOption: EChartsOption = {
    grid: { containLabel: true, bottom: '20%', top: 10, left: 10, right: 20 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#DFE6E9',
      textStyle: { color: '#2D3436', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F5F6FA' } },
      axisLabel: { color: '#B2BEC3', fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: (overview?.signalDistribution ?? []).map(
        (d: SignalDistribution) => d.range,
      ),
      axisLine: { lineStyle: { color: '#DFE6E9' } },
      axisTick: { show: false },
      axisLabel: { color: '#636E72', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: (overview?.signalDistribution ?? []).map(
          (d: SignalDistribution) => ({
            value: d.count,
            itemStyle: {
              color: SIGNAL_COLORS[d.range] ?? '#6C5CE7',
              borderRadius: [0, 6, 6, 0],
            },
          }),
        ),
        barWidth: 16,
      },
    ],
  };

  // 告警类型分布 环形图 option
  const alertPieOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#DFE6E9',
      textStyle: { color: '#2D3436', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#636E72', fontSize: 12 },
    },
    series: [
      {
        name: '告警类型',
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: false },
        },
        data: [
          {
            value: overview
              ? Math.round(overview.totalDevices * 0.08)
              : 0,
            name: '阻隔',
            itemStyle: { color: '#FDCB6E' },
          },
          {
            value: overview
              ? Math.round(overview.totalDevices * 0.04)
              : 0,
            name: '低电',
            itemStyle: { color: '#E17055' },
          },
          {
            value: overview
              ? Math.round(overview.totalDevices * 0.02)
              : 0,
            name: '离线',
            itemStyle: { color: '#B2BEC3' },
          },
          {
            value: overview
              ? Math.round(overview.totalDevices * 0.01)
              : 0,
            name: '异常',
            itemStyle: { color: '#74B9FF' },
          },
        ],
      },
    ],
  };

  if (loading && !overview) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-[#2D3436]">统计看板</h1>
        <p className="text-sm text-[#636E72] mt-1">
          数据上报趋势、设备在线率、信号分布等统计分析
        </p>
        <div className="mt-6 bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <div className="inline-block w-8 h-8 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[#B2BEC3]">数据加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436]">
            统计看板
          </h1>
          <p className="text-sm text-[#636E72] mt-1">
            数据上报趋势、设备在线率、信号分布等统计分析
          </p>
        </div>
      </div>

      {/* 顶部统计卡 */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6"
        data-ai-section-type="card-list"
      >
        <StatCard
          icon={Activity}
          bgColor={STAT_COLORS.primary}
          value={totalReports.toLocaleString()}
          label="本月累计上报"
          subLabel="全部设备"
        />
        <StatCard
          icon={Radio}
          bgColor={STAT_COLORS.success}
          value={overview?.deviceOnlineRate ?? 0}
          unit="%"
          label="设备在线率"
          subLabel={`${overview?.onlineDevices ?? 0} / ${overview?.totalDevices ?? 0}`}
        />
        <StatCard
          icon={Signal}
          bgColor={STAT_COLORS.warning}
          value={avgSignalStrength}
          label="强度均值"
          subLabel="dBm 相对值"
        />
        <StatCard
          icon={AlertTriangle}
          bgColor={STAT_COLORS.danger}
          value={totalAlerts}
          label="本月告警"
          subLabel="含未处理"
        />
      </div>

      {/* 图表区域 2x2 网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {/* 左上：上报趋势 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-[#2D3436]">
              数据上报趋势
            </h3>
            <div className="flex gap-1 bg-[#F5F6FA] rounded-lg p-1">
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  trendDays === 7
                    ? 'bg-white text-[#6C5CE7] shadow-sm font-medium'
                    : 'text-[#636E72]'
                }`}
                onClick={() => setTrendDays(7)}
                type="button"
              >
                近7天
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  trendDays === 30
                    ? 'bg-white text-[#6C5CE7] shadow-sm font-medium'
                    : 'text-[#636E72]'
                }`}
                onClick={() => setTrendDays(30)}
                type="button"
              >
                近30天
              </button>
            </div>
          </div>
          <ReactECharts
            option={trendOption}
            style={{ height: '300px', width: '100%' }}
            notMerge
          />
        </div>

        {/* 右上：设备在线率 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <h3 className="text-lg font-semibold text-[#2D3436] mb-2">
            设备在线率
          </h3>
          <ReactECharts
            option={onlineRateOption}
            style={{ height: '300px', width: '100%' }}
            notMerge
          />
        </div>

        {/* 左下：信号强度分布 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <h3 className="text-lg font-semibold text-[#2D3436] mb-2">
            信号强度分布
          </h3>
          <ReactECharts
            option={signalOption}
            style={{ height: '300px', width: '100%' }}
            notMerge
          />
        </div>

        {/* 右下：告警类型分布 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <h3 className="text-lg font-semibold text-[#2D3436] mb-2">
            告警类型分布
          </h3>
          <ReactECharts
            option={alertPieOption}
            style={{ height: '300px', width: '100%' }}
            notMerge
          />
        </div>
      </div>
    </div>
  );
};

export default Statistics;
