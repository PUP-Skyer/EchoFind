import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import {
  Activity,
  Radio,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Check,
} from 'lucide-react';
import { echofind } from '@client/src/api';
import { usePoll } from '@client/src/hooks/use-poll';
import type {
  DashboardStats,
  ReportRecord,
  Alert,
  TrendDataPoint,
} from '@shared/api.interface';
import Image from '@client/src/components/ui/image';
import ItemIcon from '@client/src/components/ui/item-icon';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setLoading(true);
      try {
        const [s, r, a, t] = await Promise.all([
          echofind.stats.dashboard(),
          echofind.stats.recentReports(8),
          echofind.stats.recentAlerts(5),
          echofind.stats.trend(7),
        ]);
        setStats(s);
        setReports(r.slice(0, 6));
        setAlerts(a);
        setTrend(t);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  usePoll(
    async (): Promise<void> => {
      if (loading) return;
      const [s, r, a, t] = await Promise.all([
        echofind.stats.dashboard(),
        echofind.stats.recentReports(8),
        echofind.stats.recentAlerts(5),
        echofind.stats.trend(7),
      ]);
      setStats(s);
      setReports(r.slice(0, 6));
      setAlerts(a);
      setTrend(t);
    },
    [],
    { intervalMs: 8000 },
  );

  const totalDevices = stats
    ? stats.onlineDevices + stats.blockedDevices + stats.offlineDevices
    : 0;
  const onlineRate = totalDevices > 0
    ? Math.round((stats!.onlineDevices / totalDevices) * 100)
    : 0;

  const pieOption: EChartsOption = {
    tooltip: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { value: stats?.onlineDevices ?? 0, itemStyle: { color: '#00B894' } },
          { value: stats?.blockedDevices ?? 0, itemStyle: { color: '#FDCB6E' } },
          { value: stats?.offlineDevices ?? 0, itemStyle: { color: '#B2BEC3' } },
        ],
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: `${onlineRate}%`,
          fontSize: 28,
          fontWeight: 700,
          fill: '#2D3436',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '60%',
        style: {
          text: '在线率',
          fontSize: 12,
          fill: '#B2BEC3',
        },
      },
    ],
  };

  const barOption: EChartsOption = {
    grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map((d: TrendDataPoint) => d.date.slice(5)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#B2BEC3', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#DFE6E9',
      textStyle: { color: '#2D3436', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: trend.map((d: TrendDataPoint) => d.count),
        barWidth: 12,
        itemStyle: {
          color: '#6C5CE7',
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  const healthConfig = {
    healthy: {
      label: '数据流运行正常',
      icon: CheckCircle,
      color: '#00B894',
    },
    warning: {
      label: '存在轻微异常',
      icon: AlertTriangle,
      color: '#FDCB6E',
    },
    critical: {
      label: '数据流中断',
      icon: XCircle,
      color: '#E17055',
    },
  };

  const alertLevelColor: Record<string, string> = {
    critical: '#E17055',
    warning: '#FDCB6E',
    info: '#74B9FF',
  };

  if (loading && !stats) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-[#2D3436]">概览</h1>
        <p className="text-sm text-[#636E72] mt-1">数据流与设备总览</p>
        <div className="mt-6 bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
          <div className="inline-block w-8 h-8 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[#B2BEC3]">数据加载中...</p>
        </div>
      </div>
    );
  }

  const currentHealth = stats ? healthConfig[stats.dataFlowHealth] : healthConfig.healthy;
  const HealthIcon = currentHealth.icon;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#2D3436]">概览</h1>
      <p className="text-sm text-[#636E72] mt-1">数据流与设备总览</p>

      <div className="mt-6 flex gap-5">
        {/* 左侧主区 */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* 状态横幅 */}
          <div
            className="rounded-2xl p-6 text-white"
            style={{
              background: 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/70">数据流健康度</p>
                <div className="mt-2 flex items-center gap-2">
                  <HealthIcon size={24} color={currentHealth.color} fill="white" fillOpacity={0.2} />
                  <span className="text-2xl font-semibold">{currentHealth.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
                  <div className="text-xl font-semibold">{stats?.onlineDevices ?? 0}</div>
                  <div className="text-xs text-white/70">在线贴纸</div>
                </div>
                <div className="rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
                  <div className="text-xl font-semibold">{stats?.blockedDevices ?? 0}</div>
                  <div className="text-xs text-white/70">被阻隔</div>
                </div>
                <div className="rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
                  <div className="text-xl font-semibold">{stats?.offlineDevices ?? 0}</div>
                  <div className="text-xs text-white/70">离线</div>
                </div>
              </div>
            </div>
          </div>

          {/* 概览统计卡 */}
          <div className="grid grid-cols-4 gap-5">
            <StatCard
              icon={Activity}
              iconBg="#6C5CE7"
              value={stats?.todayReports ?? 0}
              label="今日上报条数"
              subText="较昨日 +12%"
              subColor="#00B894"
            />
            <StatCard
              icon={Radio}
              iconBg="#00B894"
              value={stats?.onlineDevices ?? 0}
              label="在线贴纸数"
              subText={`共 ${totalDevices} 台`}
              subColor="#B2BEC3"
            />
            <StatCard
              icon={Package}
              iconBg="#74B9FF"
              value={stats?.totalItems ?? 0}
              label="物品总数"
              subText={`已存入 ${stats?.storedItems ?? 0} 件`}
              subColor="#B2BEC3"
            />
            <StatCard
              icon={AlertTriangle}
              iconBg="#FDCB6E"
              value={stats?.recentAlerts ?? 0}
              label="最近告警数"
              subText="2 条未处理"
              subColor="#E17055"
            />
          </div>

          {/* 设备状态卡 */}
          <div className="grid grid-cols-3 gap-5">
            <DeviceStatusCard
              dotColor="#00B894"
              value={stats?.onlineDevices ?? 0}
              label="在线 / 正常"
              progressColor="#00B894"
              progress={totalDevices > 0 ? (stats!.onlineDevices / totalDevices) * 100 : 0}
            />
            <DeviceStatusCard
              dotColor="#FDCB6E"
              value={stats?.blockedDevices ?? 0}
              label="阻隔 / 警告"
              progressColor="#FDCB6E"
              progress={totalDevices > 0 ? (stats!.blockedDevices / totalDevices) * 100 : 0}
            />
            <DeviceStatusCard
              dotColor="#B2BEC3"
              value={stats?.offlineDevices ?? 0}
              label="离线 / 异常"
              progressColor="#B2BEC3"
              progress={totalDevices > 0 ? (stats!.offlineDevices / totalDevices) * 100 : 0}
            />
          </div>

          {/* 最近上报卡片 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#2D3436]">最近上报</h2>
              <Link
                to="/dataflow"
                className="flex items-center gap-1 text-sm text-[#6C5CE7] hover:underline"
              >
                查看全部
                <ChevronRight size={16} />
              </Link>
            </div>
            <div className="space-y-3">
              {reports.map((report: ReportRecord) => (
                <div
                  key={report.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F5F6FA] transition-colors"
                >
                  {report.imageUrl ? (
                    <Image
                      src={report.imageUrl}
                      alt={report.itemName}
                      className="w-12 h-12 rounded-lg object-cover bg-[#F5F6FA] flex-shrink-0"
                      width={48}
                      height={48}
                    />
                  ) : (
                    <ItemIcon name={report.itemName} className="w-12 h-12 flex-shrink-0" size={48} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#2D3436] truncate">
                        {report.itemName}
                      </span>
                      <span className="text-xs text-[#B2BEC3] flex-shrink-0">
                        {report.deviceId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 h-1.5 bg-[#F5F6FA] rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${report.signalStrength}%`,
                              backgroundColor: '#00B894',
                            }}
                          />
                        </div>
                        <span className="text-xs text-[#636E72]">
                          {report.signalStrength.toFixed(0)}%
                        </span>
                      </div>
                      <span className="text-xs text-[#B2BEC3]">
                        {dayjs(report.timestamp).fromNow()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {report.isStored ? (
                      <div className="w-6 h-6 rounded-full bg-[#00B894]/10 flex items-center justify-center">
                        <Check size={14} color="#00B894" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-[#DFE6E9]" />
                    )}
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-center py-8 text-sm text-[#B2BEC3]">
                  暂无上报记录
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧统计面板 */}
        <div className="w-80 flex-shrink-0 hidden lg:flex flex-col gap-5">
          {/* 设备在线率 圆环图 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h3 className="text-lg font-semibold text-[#2D3436] mb-2">设备在线率</h3>
            <div className="h-48">
              <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00B894]" />
                <span className="text-xs text-[#636E72]">在线</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FDCB6E]" />
                <span className="text-xs text-[#636E72]">阻隔</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#B2BEC3]" />
                <span className="text-xs text-[#636E72]">离线</span>
              </div>
            </div>
          </div>

          {/* 今日上报趋势 柱状图 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h3 className="text-lg font-semibold text-[#2D3436] mb-2">上报趋势</h3>
            <div className="h-40">
              <ReactECharts option={barOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* 最近告警列表 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            <h3 className="text-lg font-semibold text-[#2D3436] mb-4">最近告警</h3>
            <div className="space-y-3">
              {alerts.map((alert: Alert) => (
                <div key={alert.id} className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      backgroundColor: alertLevelColor[alert.level] ?? '#B2BEC3',
                      boxShadow: `0 0 8px ${alertLevelColor[alert.level] ?? '#B2BEC3'}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#2D3436] line-clamp-2">{alert.message}</p>
                    <p className="text-xs text-[#B2BEC3] mt-1">
                      {dayjs(alert.timestamp).fromNow()}
                    </p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-4 text-sm text-[#B2BEC3]">
                  暂无告警
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconBg: string;
  value: number;
  label: string;
  subText: string;
  subColor: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  iconBg,
  value,
  label,
  subText,
  subColor,
}) => {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={22} color="white" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-[#2D3436]">{value}</div>
          <div className="text-sm text-[#636E72] truncate">{label}</div>
        </div>
      </div>
      <div className="mt-3 text-xs" style={{ color: subColor }}>
        {subText}
      </div>
    </div>
  );
};

interface DeviceStatusCardProps {
  dotColor: string;
  value: number;
  label: string;
  progressColor: string;
  progress: number;
}

const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({
  dotColor,
  value,
  label,
  progressColor,
  progress,
}) => {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
        />
        <span className="text-sm text-[#636E72]">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#2D3436]">{value}</div>
      <div className="mt-3 h-1.5 bg-[#F5F6FA] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: progressColor }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
