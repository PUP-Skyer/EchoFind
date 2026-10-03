import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import cachedGet, { invalidateCache } from '@client/src/utils/cached-request';
import type {
  Item,
  ItemListResponse,
  CreateItemRequest,
  UpdateItemRequest,
  Device,
  DeviceListResponse,
  Alert,
  AlertListResponse,
  DashboardStats,
  ReportRecord,
  DataFlowStatus,
  TrendDataPoint,
  SignalDistribution,
   StatsOverview,
   FeishuConfig,
   FeishuConfigUpdate,
   ModelConfig,
   ModelConfigUpdate,
    UserProfileInfo,
    BaseStationConfig,
    BaseStationConfigUpdate,
   OperationLog,
   QuickEntryListResponse,
   QuickEntrySubmitResponse,
   QuickEntrySubmitRequest,
   AIChatResponse,
   AIChatRequest,
   AIDailyRecommendResponse,
   PetProfile,
   Schedule,
   ScheduleListResponse,
   ScheduleCreateRequest,
   ScheduleUpdateRequest,
   ScheduleDayDot,
   ScheduleParseRequest,
   ScheduleParseResponse,
   ScheduleRecommendRequest,
   ScheduleRecommendResponse,
 } from '@shared/api.interface';

export const items = {
  async list(params?: { search?: string; isStored?: boolean; page?: number; pageSize?: number }): Promise<ItemListResponse> {
    const response = await axiosForBackend.get('/api/items', { params });
    return response.data;
  },
  async get(id: string): Promise<Item> {
    return cachedGet<Item>(`/api/items/${id}`);
  },
  async create(data: CreateItemRequest): Promise<Item> {
    const response = await axiosForBackend.post('/api/items', data);
    invalidateCache('/api/items');
    return response.data;
  },
  async update(id: string, data: UpdateItemRequest): Promise<Item> {
    const response = await axiosForBackend.patch(`/api/items/${id}`, data);
    invalidateCache('/api/items');
    return response.data;
  },
  async remove(id: string): Promise<{ success: boolean }> {
    const response = await axiosForBackend.delete(`/api/items/${id}`);
    invalidateCache('/api/items');
    return response.data;
  },
  async quickEntryPending(limit = 20): Promise<QuickEntryListResponse> {
    const response = await axiosForBackend.get('/api/items/quick-entry/pending', { params: { limit } });
    return response.data;
  },
  async quickEntrySubmit(data: QuickEntrySubmitRequest): Promise<QuickEntrySubmitResponse> {
    const response = await axiosForBackend.post('/api/items/quick-entry/submit', data);
    return response.data;
  },
  async dispositionStats(): Promise<{ keep: number; discard: number; recycle: number; total: number }> {
    return cachedGet('/api/items/disposition/stats');
  },
};

export const devices = {
  async list(params?: { status?: string; page?: number; pageSize?: number }): Promise<DeviceListResponse> {
    const response = await axiosForBackend.get('/api/devices', { params });
    return response.data;
  },
  async get(id: string): Promise<Device> {
    const response = await axiosForBackend.get(`/api/devices/${id}`);
    return response.data;
  },
  async bind(deviceId: string, itemId: string): Promise<Device> {
    const response = await axiosForBackend.post('/api/devices/bind', { deviceId, itemId });
    return response.data;
  },
  async unbind(id: string): Promise<Device> {
    const response = await axiosForBackend.post(`/api/devices/unbind/${id}`);
    return response.data;
  },
};

export const alerts = {
  async list(params?: { level?: string; type?: string; resolved?: boolean; page?: number; pageSize?: number }): Promise<AlertListResponse> {
    const response = await axiosForBackend.get('/api/alerts', { params });
    return response.data;
  },
  async resolve(id: string): Promise<Alert> {
    const response = await axiosForBackend.patch(`/api/alerts/${id}/resolve`);
    return response.data;
  },
  async logs(params?: { page?: number; pageSize?: number }): Promise<{ logs: OperationLog[]; total: number }> {
    const response = await axiosForBackend.get('/api/alerts/logs', { params });
    return response.data;
  },
};

export const stats = {
  async dashboard(): Promise<DashboardStats> {
    return cachedGet('/api/stats/dashboard');
  },
  async recentReports(limit = 10): Promise<ReportRecord[]> {
    return cachedGet('/api/stats/recent-reports', { limit });
  },
  async recentAlerts(limit = 5): Promise<Alert[]> {
    return cachedGet('/api/stats/recent-alerts', { limit });
  },
  async dataflow(): Promise<DataFlowStatus> {
    return cachedGet('/api/stats/dataflow');
  },
  async trend(days = 7): Promise<TrendDataPoint[]> {
    return cachedGet('/api/stats/trend', { days });
  },
  async signalDistribution(): Promise<SignalDistribution[]> {
    return cachedGet('/api/stats/signal-distribution');
  },
  async overview(): Promise<StatsOverview> {
    return cachedGet('/api/stats/overview');
  },
};

export const settings = {
  async getFeishuConfig(): Promise<FeishuConfig> {
    return cachedGet('/api/settings/feishu');
  },
  async updateFeishuConfig(data: FeishuConfigUpdate): Promise<FeishuConfig> {
    const response = await axiosForBackend.put('/api/settings/feishu', data);
    invalidateCache('/api/settings/feishu');
    return response.data;
  },
  async testFeishuConnection(): Promise<{ success: boolean; message: string }> {
    const response = await axiosForBackend.post('/api/settings/feishu/test');
    return response.data;
  },
  async getModelConfig(): Promise<ModelConfig> {
    return cachedGet('/api/settings/model');
  },
  async updateModelConfig(data: ModelConfigUpdate): Promise<ModelConfig> {
    const response = await axiosForBackend.put('/api/settings/model', data);
    invalidateCache('/api/settings/model');
    return response.data;
  },
  async testModelConnection(): Promise<{ success: boolean; message: string }> {
    const response = await axiosForBackend.post('/api/settings/model/test');
    return response.data;
  },
  async getUserProfile(): Promise<UserProfileInfo> {
    return cachedGet('/api/settings/user-profile');
  },
  async getBaseStationConfig(): Promise<BaseStationConfig> {
    return cachedGet('/api/settings/base-station');
  },
  async updateBaseStationConfig(data: BaseStationConfigUpdate): Promise<BaseStationConfig> {
    const response = await axiosForBackend.put('/api/settings/base-station', data);
    invalidateCache('/api/settings/base-station');
    return response.data;
  },
};

export const ai = {
  async chat(data: Omit<AIChatRequest, 'context'>): Promise<AIChatResponse> {
    const response = await axiosForBackend.post('/api/ai/chat', data);
    return response.data;
  },
  async *chatStream(
    data: Omit<AIChatRequest, 'context'>,
  ): AsyncGenerator<
    { type: 'delta'; content: string } | { type: 'done'; data: AIChatResponse },
    void,
    unknown
  > {
    const base = (axiosForBackend.defaults.baseURL ?? '').replace(/\/$/, '');
    const url = `${base}/api/ai/chat-stream`;
    const csrfToken = (() => {
      const match = document.cookie.match(/(?:^|; )suda-csrf-token=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : '';
    })();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-Suda-Csrf-Token'] = csrfToken;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        if (errData?.message) msg = errData.message;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          const lines = evt.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr) as
                | { type: 'delta'; content: string }
                | { type: 'done'; data: AIChatResponse }
                | { type: 'error'; message: string };
              if (parsed.type === 'error') {
                throw new Error(parsed.message);
              }
              yield parsed as
                | { type: 'delta'; content: string }
                | { type: 'done'; data: AIChatResponse };
            } catch (e) {
              if (e instanceof Error) throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
  async dailyRecommend(): Promise<AIDailyRecommendResponse> {
    const response = await axiosForBackend.get('/api/ai/daily-recommend');
    return response.data;
  },
};

export const pet = {
  async getProfile(): Promise<PetProfile> {
    return cachedGet('/api/pet/profile');
  },
  async setPetType(petType: string): Promise<PetProfile> {
    const response = await axiosForBackend.put('/api/pet/type', { petType });
    invalidateCache('/api/pet/profile');
    return response.data;
  },
  async feed(): Promise<{ profile: PetProfile; reward: number }> {
    const response = await axiosForBackend.post('/api/pet/feed');
    invalidateCache('/api/pet/profile');
    return response.data;
  },
  async play(): Promise<{ profile: PetProfile; reward: number }> {
    const response = await axiosForBackend.post('/api/pet/play');
    invalidateCache('/api/pet/profile');
    return response.data;
  },
  async setTtsEnabled(enabled: boolean): Promise<PetProfile> {
    const response = await axiosForBackend.put('/api/pet/tts', { enabled });
    invalidateCache('/api/pet/profile');
    return response.data;
  },
};

export const schedules = {
  async list(params?: { date?: string; startDate?: string; endDate?: string }): Promise<ScheduleListResponse> {
    const response = await axiosForBackend.get('/api/schedules', { params });
    return response.data;
  },
  async dayDots(params: { month: string }): Promise<{ dots: ScheduleDayDot[] }> {
    const response = await axiosForBackend.get('/api/schedules/day-dots', { params });
    return response.data;
  },
  async create(data: ScheduleCreateRequest): Promise<Schedule> {
    const response = await axiosForBackend.post('/api/schedules', data);
    return response.data;
  },
  async update(id: string, data: ScheduleUpdateRequest): Promise<Schedule> {
    const response = await axiosForBackend.patch(`/api/schedules/${id}`, data);
    return response.data;
  },
  async remove(id: string): Promise<{ success: boolean }> {
    const response = await axiosForBackend.delete(`/api/schedules/${id}`);
    return response.data;
  },
  async parse(data: ScheduleParseRequest): Promise<ScheduleParseResponse> {
    const response = await axiosForBackend.post('/api/schedules/parse', data);
    return response.data;
  },
  async recommend(params: ScheduleRecommendRequest): Promise<ScheduleRecommendResponse> {
    const response = await axiosForBackend.get('/api/schedules/recommend', { params });
    return response.data;
  },
};
