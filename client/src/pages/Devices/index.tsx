import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import {
  Radio,
  Signal,
  Battery,
  Link2,
  Unlink,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type { Device } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

type DeviceStatus = 'online' | 'offline' | 'blocked' | 'low_battery';
type FilterKey = 'all' | DeviceStatus;

const STATUS_MAP: Record<DeviceStatus, { color: string; label: string; glow: string }> = {
  online: { color: '#00B894', label: '在线', glow: '0 0 0 3px rgba(0,184,148,0.25)' },
  blocked: { color: '#FDCB6E', label: '被阻隔', glow: '0 0 0 3px rgba(253,203,110,0.25)' },
  low_battery: { color: '#E17055', label: '低电量', glow: '0 0 0 3px rgba(225,112,85,0.25)' },
  offline: { color: '#B2BEC3', label: '离线', glow: '0 0 0 3px rgba(178,190,195,0.2)' },
};

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'online', label: '在线' },
  { key: 'blocked', label: '阻隔' },
  { key: 'low_battery', label: '低电' },
  { key: 'offline', label: '离线' },
];

const Devices: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page] = useState<number>(1);
  const [pageSize] = useState<number>(20);

  const [bindDialogOpen, setBindDialogOpen] = useState<boolean>(false);
  const [unbindDialogOpen, setUnbindDialogOpen] = useState<boolean>(false);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [bindItemId, setBindItemId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const fetchDevices = async (): Promise<void> => {
      setLoading(true);
      try {
        const params: { status?: string; page: number; pageSize: number } = {
          page,
          pageSize,
        };
        if (filter !== 'all') params.status = filter;
        const res = await echofind.devices.list(params);
        setDevices(res.devices);
        setTotal(res.total);
      } catch (err: unknown) {
        logger.error('加载设备列表失败', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchDevices();
  }, [filter, page, pageSize]);

  const onlineCount = devices.filter((d: Device) => d.status === 'online').length;
  const blockedCount = devices.filter((d: Device) => d.status === 'blocked').length;
  const lowBatteryCount = devices.filter((d: Device) => d.status === 'low_battery').length;

  const openBindDialog = (device: Device): void => {
    setCurrentDevice(device);
    setBindItemId(device.boundItemId ?? '');
    setBindDialogOpen(true);
  };

  const openUnbindDialog = (device: Device): void => {
    setCurrentDevice(device);
    setUnbindDialogOpen(true);
  };

  const handleBind = async (): Promise<void> => {
    if (!currentDevice || !bindItemId.trim()) return;
    setSubmitting(true);
    try {
      const updated = await echofind.devices.bind(currentDevice.id, bindItemId.trim());
      setDevices((prev: Device[]) =>
        prev.map((d: Device) => (d.id === updated.id ? updated : d))
      );
      setBindDialogOpen(false);
    } catch (err: unknown) {
      logger.error('绑定失败', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnbind = async (): Promise<void> => {
    if (!currentDevice) return;
    setSubmitting(true);
    try {
      const updated = await echofind.devices.unbind(currentDevice.id);
      setDevices((prev: Device[]) =>
        prev.map((d: Device) => (d.id === updated.id ? updated : d))
      );
      setUnbindDialogOpen(false);
    } catch (err: unknown) {
      logger.error('解绑失败', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatLastSeen = (iso: string): string => {
    return dayjs(iso).fromNow();
  };

  const renderStatCard = (
    icon: React.ReactNode,
    iconBg: string,
    iconColor: string,
    value: number,
    label: string
  ): React.ReactNode => (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)] flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#2D3436]">{value}</div>
        <div className="text-xs text-[#636E72] mt-0.5">{label}</div>
      </div>
    </div>
  );

  const renderStatusDot = (status: DeviceStatus): React.ReactNode => {
    const s = STATUS_MAP[status];
    const isPulsing = status === 'online';
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
        <span
          className={`inline-block w-2 h-2 rounded-full ${isPulsing ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: s.color, boxShadow: s.glow }}
        />
      </div>
    );
  };

  const renderProgress = (
    value: number,
    color: string,
    icon: React.ReactNode,
    suffix?: string
  ): React.ReactNode => (
    <div className="flex items-center gap-2">
      <span className="text-[#636E72] flex-shrink-0">{icon}</span>
      <div className="flex-1 h-1.5 bg-[#DFE6E9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-[#636E72] w-10 text-right flex-shrink-0">
        {Math.round(value)}{suffix ?? ''}
      </span>
    </div>
  );

  return (
    <div className="pb-8">
      {/* 顶部工具栏 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D3436]">设备管理</h1>
          <p className="text-sm text-[#636E72] mt-1">管理所有 ESP32 贴纸设备</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl p-1 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            {FILTER_TABS.map((tab: { key: FilterKey; label: string }) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === tab.key
                    ? 'bg-[#6C5CE7] text-white font-medium'
                    : 'text-[#636E72] hover:text-[#2D3436]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-[#B2BEC3] ml-2">共 {total} 台</span>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {renderStatCard(
          <Radio size={22} />,
          'rgba(108,92,231,0.1)',
          '#6C5CE7',
          devices.length,
          '总设备数'
        )}
        {renderStatCard(
          <Radio size={22} />,
          'rgba(0,184,148,0.1)',
          '#00B894',
          onlineCount,
          '在线设备'
        )}
        {renderStatCard(
          <Radio size={22} />,
          'rgba(253,203,110,0.15)',
          '#FDCB6E',
          blockedCount,
          '阻隔设备'
        )}
        {renderStatCard(
          <Radio size={22} />,
          'rgba(225,112,85,0.1)',
          '#E17055',
          lowBatteryCount,
          '低电设备'
        )}
      </div>

      {/* 设备列表 */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-[#B2BEC3]">数据加载中...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#B2BEC3]">暂无设备</div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {devices.map((device: Device) => {
              const statusInfo = STATUS_MAP[device.status];
              const batteryColor = device.battery < 20 ? '#E17055' : '#00B894';
              return (
                <div
                  key={device.id}
                  className="border border-[#DFE6E9] rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  {/* 状态灯 */}
                  {renderStatusDot(device.status)}

                  {/* 设备编号 */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold text-[#2D3436]">
                      {device.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F6FA] text-[#636E72]">
                      贴纸
                    </span>
                  </div>

                  {/* 信号 + 电量 */}
                  <div className="space-y-2">
                    {renderProgress(
                      device.signalStrength,
                      statusInfo.color,
                      <Signal size={14} />,
                      ''
                    )}
                    {renderProgress(
                      device.battery,
                      batteryColor,
                      <Battery size={14} />,
                      '%'
                    )}
                  </div>

                  {/* 分割线 */}
                  <div className="border-t border-[#F5F6FA]" />

                  {/* 底部信息 */}
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#B2BEC3]">绑定物品</span>
                      <span
                        className={
                          device.boundItemName
                            ? 'text-[#2D3436] font-medium truncate max-w-[60%] text-right'
                            : 'text-[#B2BEC3]'
                        }
                        title={device.boundItemName ?? ''}
                      >
                        {device.boundItemName ?? '未绑定'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#B2BEC3]">最后在线</span>
                      <span className="text-[#636E72]">
                        {formatLastSeen(device.lastSeen)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-1">
                    {device.boundItemId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[#E17055] border-[#E17055]/30 hover:bg-[#E17055]/5"
                        onClick={() => openUnbindDialog(device)}
                      >
                        <Unlink size={14} />
                        解绑
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[#6C5CE7] border-[#6C5CE7]/30 hover:bg-[#6C5CE7]/5"
                        onClick={() => openBindDialog(device)}
                      >
                        <Link2 size={14} />
                        绑定
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 绑定弹窗 */}
      <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>绑定物品</DialogTitle>
            <DialogDescription>
              将设备 {currentDevice?.id} 绑定到指定物品
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm text-[#636E72] mb-1.5 block">物品 ID</label>
            <Input
              value={bindItemId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setBindItemId(e.target.value)
              }
              placeholder="请输入物品 ID"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              style={{ backgroundColor: '#6C5CE7' }}
              onClick={handleBind}
              disabled={submitting || !bindItemId.trim()}
            >
              {submitting ? '绑定中...' : '确认绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解绑确认弹窗 */}
      <Dialog open={unbindDialogOpen} onOpenChange={setUnbindDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>解绑确认</DialogTitle>
            <DialogDescription>
              确定要解绑设备 {currentDevice?.id} 吗？解绑后该设备将不再关联任何物品。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              style={{ backgroundColor: '#E17055' }}
              onClick={handleUnbind}
              disabled={submitting}
            >
              {submitting ? '解绑中...' : '确认解绑'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Devices;
