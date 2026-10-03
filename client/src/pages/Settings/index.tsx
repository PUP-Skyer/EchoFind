import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Bell,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type { FeishuConfig } from '@shared/api.interface';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';
import { Label } from '@client/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';

type TabKey = 'feishu' | 'base-station' | 'notifications' | 'refresh' | 'about';

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { key: 'feishu', label: '飞书连接', icon: Zap },
  { key: 'base-station', label: '基站位置', icon: Radio },
  { key: 'notifications', label: '通知设置', icon: Bell },
  { key: 'refresh', label: '刷新频率', icon: RefreshCw },
  { key: 'about', label: '关于', icon: Info },
];

interface NotificationSettings {
  alertNotify: boolean;
  dailyDigest: boolean;
  offlineReminder: boolean;
}

interface RefreshOptions {
  value: string;
  label: string;
}

const REFRESH_OPTIONS: RefreshOptions[] = [
  { value: '5s', label: '5 秒' },
  { value: '15s', label: '15 秒' },
  { value: '30s', label: '30 秒' },
  { value: '1m', label: '1 分钟' },
];

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return iso;
  }
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('feishu');

  // Feishu config state
  const [config, setConfig] = useState<FeishuConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [appId, setAppId] = useState<string>('');
  const [appSecret, setAppSecret] = useState<string>('');
  const [appToken, setAppToken] = useState<string>('');
  const [tableId, setTableId] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [secretModified, setSecretModified] = useState<boolean>(false);

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    alertNotify: true,
    dailyDigest: true,
    offlineReminder: false,
  });

  // Refresh frequency
  const [refreshFreq, setRefreshFreq] = useState<string>('15s');

  // Base station settings
  const [baseStationLocation, setBaseStationLocation] = useState<string>('客厅');
  const [strongThreshold, setStrongThreshold] = useState<number>(70);
  const [savingStation, setSavingStation] = useState<boolean>(false);
  const [stationSaved, setStationSaved] = useState<boolean>(false);

  const fetchBaseStation = useCallback(async (): Promise<void> => {
    try {
      const data = await echofind.settings.getBaseStationConfig();
      setBaseStationLocation(data.locationName || '客厅');
      setStrongThreshold(data.strongSignalThreshold || 70);
    } catch (error: unknown) {
      logger.error('获取基站配置失败', error);
    }
  }, []);

  const fetchConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await echofind.settings.getFeishuConfig();
      setConfig(data);
      setAppId(data.appId || '');
      setAppSecret(data.appSecretMasked || '');
      setAppToken(data.appToken || '');
      setTableId(data.tableId || '');
      setSecretModified(false);
    } catch (error: unknown) {
      logger.error('获取飞书配置失败', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
    void fetchBaseStation();
  }, [fetchConfig, fetchBaseStation]);

  const handleSecretChange = (value: string): void => {
    setAppSecret(value);
    setSecretModified(true);
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSaveSuccess(false);
    setTestResult(null);
    try {
      const updateData: {
        appId: string;
        appToken: string;
        tableId: string;
        appSecret?: string;
      } = {
        appId,
        appToken,
        tableId,
      };
      if (secretModified) {
        updateData.appSecret = appSecret;
      }
      const updated = await echofind.settings.updateFeishuConfig(updateData);
      setConfig(updated);
      setAppSecret(updated.appSecretMasked);
      setSecretModified(false);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: unknown) {
      logger.error('保存飞书配置失败', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (): void => {
    if (!config) return;
    setAppId(config.appId || '');
    setAppSecret(config.appSecretMasked || '');
    setAppToken(config.appToken || '');
    setTableId(config.tableId || '');
    setSecretModified(false);
    setSaveSuccess(false);
    setTestResult(null);
  };

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await echofind.settings.testFeishuConnection();
      setTestResult(result);
    } catch (error: unknown) {
      logger.error('测试连接失败', error);
      setTestResult({ success: false, message: '测试请求失败，请检查网络' });
    } finally {
      setTesting(false);
    }
  };

  const displaySecret = secretModified ? appSecret : (config?.appSecretMasked || '');

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#2D3436]">设置</h1>
        <p className="mt-1 text-sm text-[#636E72]">配置飞书连接与系统参数</p>
      </div>

      {/* Main layout: sidebar tabs + content */}
      <div className="flex gap-5">
        {/* Left sidebar tabs */}
        <aside className="w-56 shrink-0">
          <nav className="flex flex-col gap-1 rounded-2xl bg-white p-2 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
            {TABS.map((tab: TabItem) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[#6C5CE7]/10 text-[#6C5CE7] font-medium'
                      : 'text-[#636E72] hover:bg-[#F5F6FA] hover:text-[#2D3436]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right content area */}
        <main className="flex-1 min-w-0">
          {activeTab === 'feishu' && (
            <div className="flex flex-col gap-5">
              {/* Connection status card */}
              <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div
                        className={`h-4 w-4 rounded-full ${
                          config?.connected
                            ? 'bg-[#00B894]'
                            : 'bg-[#B2BEC3]'
                        }`}
                      />
                      {config?.connected && (
                        <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-[#00B894]/40" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#2D3436]">
                        飞书连接状态
                      </h3>
                      <p className="mt-0.5 text-xs text-[#636E72]">
                        {config?.connected
                          ? `已连接 · 最近测试：${formatTime(config.lastTestTime)}`
                          : '未连接'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || loading}
                    className="border-[#6C5CE7]/30 text-[#6C5CE7] hover:bg-[#6C5CE7]/5"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        测试中
                      </>
                    ) : (
                      '测试连接'
                    )}
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                      testResult.success
                        ? 'bg-[#00B894]/10 text-[#00B894]'
                        : 'bg-[#E17055]/10 text-[#E17055]'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Config form card */}
              <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
                <h2 className="text-lg font-semibold text-[#2D3436]">
                  飞书应用配置
                </h2>
                <p className="mt-1 text-xs text-[#B2BEC3]">
                  配置飞书开放平台自建应用的凭证信息
                </p>

                {loading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#6C5CE7]" />
                    <p className="mt-3 text-sm text-[#B2BEC3]">加载中...</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 space-y-5">
                      {/* App ID */}
                      <div>
                        <Label
                          htmlFor="appId"
                          className="text-sm font-medium text-[#2D3436]"
                        >
                          App ID
                        </Label>
                        <Input
                          id="appId"
                          type="text"
                          value={appId}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAppId(e.target.value)
                          }
                          placeholder="请输入 App ID"
                          className="mt-1.5 h-10"
                        />
                        <p className="mt-1.5 text-xs text-[#B2BEC3]">
                          在飞书开放平台「凭证与基础信息」中获取
                        </p>
                      </div>

                      {/* App Secret */}
                      <div>
                        <Label
                          htmlFor="appSecret"
                          className="text-sm font-medium text-[#2D3436]"
                        >
                          App Secret
                        </Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="appSecret"
                            type={showSecret ? 'text' : 'password'}
                            value={displaySecret}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => handleSecretChange(e.target.value)}
                            placeholder="请输入 App Secret"
                            className="h-10 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#B2BEC3] hover:text-[#636E72]"
                            aria-label={showSecret ? '隐藏密钥' : '显示密钥'}
                          >
                            {showSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-[#B2BEC3]">
                          修改时请输入完整的 App Secret
                        </p>
                      </div>

                      {/* App Token */}
                      <div>
                        <Label
                          htmlFor="appToken"
                          className="text-sm font-medium text-[#2D3436]"
                        >
                          多维表格 App Token
                        </Label>
                        <Input
                          id="appToken"
                          type="text"
                          value={appToken}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAppToken(e.target.value)
                          }
                          placeholder="请输入多维表格 App Token"
                          className="mt-1.5 h-10"
                        />
                        <p className="mt-1.5 text-xs text-[#B2BEC3]">
                          多维表格 URL 中 b 开头的标识（如 bascnxxxxxxxxx）
                        </p>
                      </div>

                      {/* Table ID */}
                      <div>
                        <Label
                          htmlFor="tableId"
                          className="text-sm font-medium text-[#2D3436]"
                        >
                          数据表 Table ID
                        </Label>
                        <Input
                          id="tableId"
                          type="text"
                          value={tableId}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTableId(e.target.value)
                          }
                          placeholder="请输入数据表 Table ID"
                          className="mt-1.5 h-10"
                        />
                        <p className="mt-1.5 text-xs text-[#B2BEC3]">
                          多维表格 URL 中 table/tbl 开头的数据表 ID
                        </p>
                      </div>
                    </div>

                    {/* Save success toast */}
                    {saveSuccess && (
                      <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#00B894]/10 px-4 py-3 text-sm text-[#00B894]">
                        <CheckCircle2 className="h-4 w-4" />
                        配置保存成功
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            保存中
                          </>
                        ) : (
                          '保存配置'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={saving || loading}
                      >
                        重置
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Usage guide card */}
              <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
                <h2 className="text-lg font-semibold text-[#2D3436]">配置说明</h2>
                <p className="mt-1 text-xs text-[#B2BEC3]">
                  按照以下步骤完成飞书多维表格对接
                </p>
                <ol className="mt-4 space-y-3">
                  {[
                    '前往飞书开放平台创建自建应用',
                    '开启「多维表格」权限',
                    '将应用添加到多维表格协作者',
                    '填入 App ID 和 App Secret',
                    '点击测试连接验证',
                  ].map((step: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6C5CE7]/10 text-xs font-medium text-[#6C5CE7]">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 text-[#2D3436]">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'base-station' && (
            <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
              <h2 className="text-lg font-semibold text-[#2D3436]">基站位置</h2>
              <p className="mt-1 text-xs text-[#B2BEC3]">
                设置 ESP32 基站所在房间，小寻会根据信号强弱推断物品在哪个房间
              </p>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label>基站所在房间</Label>
                  <Select
                    value={baseStationLocation}
                    onValueChange={(val: string): void => setBaseStationLocation(val)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="客厅">客厅</SelectItem>
                      <SelectItem value="卧室">卧室</SelectItem>
                      <SelectItem value="储物柜">储物柜</SelectItem>
                    </SelectContent>
                  </Select>
                    <p className="text-xs text-[#B2BEC3]">
                      基站在{baseStationLocation}时，信号最强的物品判定为在{baseStationLocation}，信号依次减弱判定为在其余房间
                    </p>
                </div>
                <div className="space-y-2">
                  <Label>强信号阈值（{strongThreshold}%）</Label>
                  <input
                    type="range"
                    min={30}
                    max={90}
                    step={5}
                    value={strongThreshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                      setStrongThreshold(Number(e.target.value))
                    }
                    className="w-64 accent-[#6C5CE7]"
                  />
                  <p className="text-xs text-[#B2BEC3]">
                    信号 ≥ {strongThreshold}% 判定为离基站近（同房间），低于则为在另一个房间
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={(): void => {
                      setSavingStation(true);
                      setStationSaved(false);
                      void echofind.settings
                        .updateBaseStationConfig({
                          location: baseStationLocation,
                          strongSignalThreshold: strongThreshold,
                        })
                        .then(() => {
                          setStationSaved(true);
                          window.setTimeout(() => setStationSaved(false), 2500);
                        })
                        .catch((err: unknown) => {
                          logger.error('保存基站配置失败', err);
                        })
                        .finally(() => setSavingStation(false));
                    }}
                    disabled={savingStation}
                    className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white border-[#6C5CE7]"
                  >
                    {savingStation && <Loader2 className="h-4 w-4 animate-spin" />}
                    保存设置
                  </Button>
                  {stationSaved && (
                    <span className="text-xs text-[#00B894] flex items-center gap-1">
                      <CheckCircle2 size={14} /> 已保存
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
              <h2 className="text-lg font-semibold text-[#2D3436]">通知设置</h2>
              <p className="mt-1 text-xs text-[#B2BEC3]">
                自定义需要接收的通知类型
              </p>
              <div className="mt-6 space-y-4">
                {[
                  {
                    key: 'alertNotify' as const,
                    label: '告警通知',
                    desc: '设备离线、信号中断等异常情况实时通知',
                  },
                  {
                    key: 'dailyDigest' as const,
                    label: '每日汇总',
                    desc: '每日早晨推送前一天的数据汇总报告',
                  },
                  {
                    key: 'offlineReminder' as const,
                    label: '离线提醒',
                    desc: '设备持续离线超过 30 分钟时提醒',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-[#DFE6E9] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#2D3436]">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[#B2BEC3]">
                        {item.desc}
                      </p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked: boolean) =>
                        setNotifications((prev) => ({
                          ...prev,
                          [item.key]: checked,
                        }))
                      }
                      className="data-[state=checked]:bg-[#6C5CE7]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'refresh' && (
            <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
              <h2 className="text-lg font-semibold text-[#2D3436]">刷新频率</h2>
              <p className="mt-1 text-xs text-[#B2BEC3]">
                设置数据自动刷新的时间间隔
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {REFRESH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRefreshFreq(opt.value)}
                    className={`rounded-xl border px-4 py-4 text-center text-sm transition-colors ${
                      refreshFreq === opt.value
                        ? 'border-[#6C5CE7] bg-[#6C5CE7]/5 text-[#6C5CE7] font-medium'
                        : 'border-[#DFE6E9] text-[#2D3436] hover:border-[#A29BFE]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#B2BEC3]">
                提示：频率越高实时性越强，但会增加服务器负载
              </p>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
              <h2 className="text-lg font-semibold text-[#2D3436]">关于</h2>
              <p className="mt-1 text-xs text-[#B2BEC3]">
                EchoFind 中控台应用信息
              </p>
              <div className="mt-6 space-y-4">
                {[
                  { label: '应用名称', value: 'EchoFind 中控台' },
                  { label: '版本号', value: 'v1.0.0' },
                  {
                    label: '技术栈',
                    value: 'React 19 + NestJS 10 + Drizzle ORM + Postgres',
                  },
                  { label: '数据底座', value: '飞书多维表格 / 本地数据库' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between border-b border-[#F5F6FA] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-sm text-[#636E72]">{item.label}</span>
                    <span className="text-sm text-[#2D3436]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-[#B2BEC3]">
                © 2025 EchoFind Team. All rights reserved.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
