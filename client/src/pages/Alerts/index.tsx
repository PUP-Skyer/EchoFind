import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Check,
  Edit,
  Trash2,
  Plus,
  Link2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Recycle,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import { echofind } from '@client/src/api';
import type { Alert, OperationLog } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { logger } from '@lark-apaas/client-toolkit/logger';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

type AlertLevel = 'all' | 'critical' | 'warning' | 'info';
type ResolvedFilter = 'all' | 'unresolved' | 'resolved';
type TabKey = 'alerts' | 'logs';

const LEVEL_COLORS: Record<string, string> = {
  critical: '#E17055',
  warning: '#FDCB6E',
  info: '#74B9FF',
};

const TYPE_LABELS: Record<string, string> = {
  blocked: '信号阻隔',
  low_battery: '低电量',
  offline: '设备离线',
  abnormal: '异常上报',
};

const LEVEL_LABELS: Record<string, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
};

function LevelIcon({ level, size = 20 }: { level: string; size?: number }) {
  const color = LEVEL_COLORS[level] ?? '#B2BEC3';
  if (level === 'critical') {
    return <AlertTriangle size={size} color={color} fill={color} fillOpacity={0.15} />;
  }
  if (level === 'warning') {
    return <AlertCircle size={size} color={color} fill={color} fillOpacity={0.15} />;
  }
  return <Info size={size} color={color} fill={color} fillOpacity={0.15} />;
}

function ActionIcon({ action }: { action: string }) {
  const lower = action.toLowerCase();
  if (lower.includes('删除') || lower.includes('delete') || lower.includes('remove')) {
    return <Trash2 size={16} className="text-[#E17055]" />;
  }
  if (lower.includes('新增') || lower.includes('创建') || lower.includes('create') || lower.includes('add')) {
    return <Plus size={16} className="text-[#00B894]" />;
  }
  if (lower.includes('绑定') || lower.includes('关联') || lower.includes('link') || lower.includes('bind')) {
    return <Link2 size={16} className="text-[#6C5CE7]" />;
  }
  return <Edit size={16} className="text-[#636E72]" />;
}

const Alerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('alerts');

  // Stats: item disposition counts
  const [statsLoading, setStatsLoading] = useState(false);
  const [keepCount, setKeepCount] = useState(0);
  const [discardCount, setDiscardCount] = useState(0);
  const [recycleCount, setRecycleCount] = useState(0);

  // Alerts tab
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState<AlertLevel>('all');
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [alertPage, setAlertPage] = useState(1);
  const pageSize = 10;

  // Logs tab
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Fetch disposition stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await echofind.items.dispositionStats();
      setKeepCount(res.keep);
      setDiscardCount(res.discard);
      setRecycleCount(res.recycle);
    } catch (err: unknown) {
      logger.error('获取物品去向统计失败', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch alerts list
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const params: {
        level?: string;
        resolved?: boolean;
        page: number;
        pageSize: number;
      } = {
        page: alertPage,
        pageSize,
      };
      if (levelFilter !== 'all') params.level = levelFilter;
      if (resolvedFilter === 'unresolved') params.resolved = false;
      else if (resolvedFilter === 'resolved') params.resolved = true;

      const res = await echofind.alerts.list(params);
      // client-side search filter
      let list = res.alerts;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        list = list.filter((a: Alert) =>
          a.message.toLowerCase().includes(q) ||
          a.deviceId.toLowerCase().includes(q) ||
          a.itemName.toLowerCase().includes(q)
        );
      }
      setAlerts(list);
      setAlertsTotal(res.total);
    } catch (err: unknown) {
      logger.error('获取告警列表失败', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await echofind.alerts.logs({ page: logPage, pageSize });
      setLogs(res.logs);
      setLogsTotal(res.total);
    } catch (err: unknown) {
      logger.error('获取操作日志失败', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setAlertPage(1);
  }, [levelFilter, resolvedFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [levelFilter, resolvedFilter, alertPage]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, logPage]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await echofind.alerts.resolve(id);
      await Promise.all([fetchAlerts(), fetchStats()]);
    } catch (err: unknown) {
      logger.error('标记已处理失败', err);
    } finally {
      setResolvingId(null);
    }
  };

  const totalAlertPages = useMemo(
    () => Math.max(1, Math.ceil(alertsTotal / pageSize)),
    [alertsTotal]
  );
  const totalLogPages = useMemo(
    () => Math.max(1, Math.ceil(logsTotal / pageSize)),
    [logsTotal]
  );

  const [animatedCounts, setAnimatedCounts] = useState<{ keep: number; discard: number; recycle: number }>({
    keep: 0,
    discard: 0,
    recycle: 0,
  });

  useEffect(() => {
    if (statsLoading) return;
    const targets = { keep: keepCount, discard: discardCount, recycle: recycleCount };
    const duration = 1200;
    const startTime = performance.now();
    const startValues = { keep: 0, discard: 0, recycle: 0 };

    let rafId = 0;
    const tick = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedCounts({
        keep: Math.round(startValues.keep + (targets.keep - startValues.keep) * ease),
        discard: Math.round(startValues.discard + (targets.discard - startValues.discard) * ease),
        recycle: Math.round(startValues.recycle + (targets.recycle - startValues.recycle) * ease),
      });
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [statsLoading, keepCount, discardCount, recycleCount]);

  const totalDisposition = useMemo(() => {
    return keepCount + discardCount + recycleCount;
  }, [keepCount, discardCount, recycleCount]);

  const animatedTotal = animatedCounts.keep + animatedCounts.discard + animatedCounts.recycle;

  const statCards = [
    {
      key: 'keep',
      label: '保留',
      count: keepCount,
      color: '#00B894',
      bgLight: 'rgba(0, 184, 148, 0.12)',
      icon: <CheckCircle2 size={24} color="#00B894" />,
      loading: statsLoading,
    },
    {
      key: 'discard',
      label: '丢弃',
      count: discardCount,
      color: '#636E72',
      bgLight: 'rgba(99, 110, 114, 0.12)',
      icon: <Trash2 size={24} color="#636E72" />,
      loading: statsLoading,
    },
    {
      key: 'recycle',
      label: '回收',
      count: recycleCount,
      color: '#74B9FF',
      bgLight: 'rgba(116, 185, 255, 0.15)',
      icon: <Recycle size={24} color="#74B9FF" />,
      loading: statsLoading,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436]">告警日志</h1>
          <p className="text-sm text-[#636E72] mt-1">查看与处理所有设备异常告警记录</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-5 mt-6" data-ai-section-type="card-stat">
        {statCards.map((card) => {
          const animatedCount = animatedCounts[card.key as 'keep' | 'discard' | 'recycle'];
          const percentage = totalDisposition > 0
            ? (animatedCount / Math.max(1, animatedTotal)) * 100
            : 0;
          return (
            <div
              key={card.key}
              className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex flex-col"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: card.bgLight }}
                >
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  {card.loading ? (
                    <div className="h-8 w-16 bg-[#F5F6FA] rounded animate-pulse" />
                  ) : (
                    <div
                      className="text-3xl font-bold leading-tight"
                      style={{ color: card.color }}
                    >
                      {animatedCount}
                    </div>
                  )}
                  <div className="text-sm text-[#636E72] mt-1">{card.label}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-[#B2BEC3] mb-1.5">
                  <span>占比</span>
                  <span>{percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-[#F5F6FA] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: card.loading ? '0%' : `${percentage}%`,
                      backgroundColor: card.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="mt-6 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0_0_0_0.03)] overflow-hidden">
        <div className="flex border-b border-[#DFE6E9] px-6">
          <button
            className={`relative px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'text-[#6C5CE7]'
                : 'text-[#636E72] hover:text-[#2D3436]'
            }`}
            onClick={() => setActiveTab('alerts')}
          >
            告警列表
            {activeTab === 'alerts' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6C5CE7] rounded-t" />
            )}
          </button>
          <button
            className={`relative px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'text-[#6C5CE7]'
                : 'text-[#636E72] hover:text-[#2D3436]'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            操作日志
            {activeTab === 'logs' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6C5CE7] rounded-t" />
            )}
          </button>
        </div>

        {/* Alerts Tab Content */}
        {activeTab === 'alerts' && (
          <div>
            {/* Filter bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE6E9]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-[#F5F6FA] rounded-full p-1">
                  {(['all', 'critical', 'warning', 'info'] as AlertLevel[]).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => setLevelFilter(lv)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        levelFilter === lv
                          ? 'bg-white shadow-sm text-[#2D3436]'
                          : 'text-[#636E72] hover:text-[#2D3436]'
                      }`}
                    >
                      {lv === 'all' ? '全部' : LEVEL_LABELS[lv]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-[#F5F6FA] rounded-full p-1">
                  {(['all', 'unresolved', 'resolved'] as ResolvedFilter[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setResolvedFilter(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        resolvedFilter === st
                          ? 'bg-white shadow-sm text-[#2D3436]'
                          : 'text-[#636E72] hover:text-[#2D3436]'
                      }`}
                    >
                      {st === 'all' ? '全部' : st === 'unresolved' ? '未处理' : '已处理'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative w-64">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B2BEC3]"
                />
                <Input
                  placeholder="搜索告警消息 / 设备 / 物品"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9 text-sm h-9"
                />
              </div>
            </div>

            {/* Alert list */}
            {alertsLoading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#6C5CE7]" />
                <span className="ml-2 text-sm text-[#636E72]">加载中...</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-16 text-center">
                <Info size={32} className="mx-auto text-[#B2BEC3]" />
                <p className="mt-3 text-sm text-[#B2BEC3]">暂无告警记录</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2F5]">
                {alerts.map((alert: Alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F9FB] transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${LEVEL_COLORS[alert.level]}15` }}
                    >
                      <LevelIcon level={alert.level} size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#2D3436] truncate">
                          {alert.message}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-normal"
                          style={{
                            color: LEVEL_COLORS[alert.level],
                            borderColor: `${LEVEL_COLORS[alert.level]}55`,
                            backgroundColor: `${LEVEL_COLORS[alert.level]}10`,
                          }}
                        >
                          {TYPE_LABELS[alert.type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#636E72]">
                        <span className="font-mono">{alert.deviceId}</span>
                        <span className="text-[#DFE6E9]">·</span>
                        <span>{alert.itemName}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right mr-2">
                      <div className="text-xs text-[#B2BEC3]">
                        {dayjs(alert.timestamp).fromNow()}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {alert.resolved ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#B2BEC3] px-2 py-1">
                          <Check size={12} />
                          已处理
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolvingId === alert.id}
                          onClick={() => handleResolve(alert.id)}
                          className="text-xs h-7 px-3 border-[#DFE6E9] text-[#636E72] hover:text-[#2D3436]"
                        >
                          {resolvingId === alert.id ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : null}
                          标记已处理
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {alerts.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#DFE6E9]">
                <div className="text-xs text-[#636E72]">
                  共 {alertsTotal} 条告警
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={alertPage <= 1}
                    onClick={() => setAlertPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 p-0 border-[#DFE6E9]"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-sm text-[#2D3436] min-w-[60px] text-center">
                    {alertPage} / {totalAlertPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={alertPage >= totalAlertPages}
                    onClick={() => setAlertPage((p) => Math.min(totalAlertPages, p + 1))}
                    className="h-8 w-8 p-0 border-[#DFE6E9]"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab Content */}
        {activeTab === 'logs' && (
          <div>
            {logsLoading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#6C5CE7]" />
                <span className="ml-2 text-sm text-[#636E72]">加载中...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center">
                <Info size={32} className="mx-auto text-[#B2BEC3]" />
                <p className="mt-3 text-sm text-[#B2BEC3]">暂无操作日志</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2F5]">
                {logs.map((log: OperationLog) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F9FB] transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#F5F6FA] flex items-center justify-center">
                      <ActionIcon action={log.action} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#2D3436]">
                          {log.action}
                        </span>
                        <span className="text-xs text-[#636E72]">
                          {log.target}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#636E72]">
                        <span>操作人：{log.operator}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs text-[#B2BEC3]">
                        {dayjs(log.timestamp).fromNow()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {logs.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#DFE6E9]">
                <div className="text-xs text-[#636E72]">
                  共 {logsTotal} 条记录
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logPage <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 p-0 border-[#DFE6E9]"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-sm text-[#2D3436] min-w-[60px] text-center">
                    {logPage} / {totalLogPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logPage >= totalLogPages}
                    onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                    className="h-8 w-8 p-0 border-[#DFE6E9]"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
