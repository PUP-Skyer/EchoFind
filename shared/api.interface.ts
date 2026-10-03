export type ItemDisposition = 'keep' | 'discard' | 'recycle';

export interface Item {
  id: string;
  name: string;
  signalStrength: number;
  reportTime: string;
  isStored: boolean;
  imageUrl: string;
  deviceId: string;
  disposition: ItemDisposition;
  location: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
}

export interface CreateItemRequest {
  id: string;
  name: string;
  signalStrength?: number;
  isStored?: boolean;
  imageUrl?: string;
  deviceId?: string;
  disposition?: ItemDisposition;
  location?: string;
}

export interface UpdateItemRequest {
  name?: string;
  signalStrength?: number;
  isStored?: boolean;
  imageUrl?: string;
  deviceId?: string;
  disposition?: ItemDisposition;
  location?: string;
}

export interface Device {
  id: string;
  status: 'online' | 'offline' | 'blocked' | 'low_battery';
  signalStrength: number;
  battery: number;
  boundItemId: string | null;
  boundItemName: string | null;
  lastSeen: string;
}

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export interface BindDeviceRequest {
  deviceId: string;
  itemId: string;
}

export interface Alert {
  id: string;
  type: 'blocked' | 'low_battery' | 'offline' | 'abnormal';
  level: 'critical' | 'warning' | 'info';
  deviceId: string;
  itemName: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
}

export interface DashboardStats {
  todayReports: number;
  onlineDevices: number;
  totalItems: number;
  storedItems: number;
  recentAlerts: number;
  blockedDevices: number;
  offlineDevices: number;
  dataFlowHealth: 'healthy' | 'warning' | 'critical';
}

export interface ReportRecord {
  id: string;
  deviceId: string;
  itemName: string;
  signalStrength: number;
  timestamp: string;
  isStored: boolean;
  imageUrl: string;
}

export interface DataFlowStatus {
  esp32Status: 'connected' | 'disconnected';
  feishuStatus: 'connected' | 'disconnected';
  latency: number;
  lastSyncTime: string | null;
  todayReports: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface SignalDistribution {
  range: string;
  count: number;
}

export interface StatsOverview {
  reportTrend: TrendDataPoint[];
  deviceOnlineRate: number;
  signalDistribution: SignalDistribution[];
  totalDevices: number;
  onlineDevices: number;
}

export interface FeishuConfig {
  appId: string;
  appSecretMasked: string;
  appToken: string;
  tableId: string;
  connected: boolean;
  lastTestTime: string | null;
}

export interface FeishuConfigUpdate {
  appId?: string;
  appSecret?: string;
  appToken?: string;
  tableId?: string;
}

export interface QuickEntryItem {
  id: string;
  name: string;
  signalStrength: number;
  reportTime: string;
  isStored: boolean;
  imageUrl: string;
  deviceId: string;
}

export interface QuickEntryListResponse {
  items: QuickEntryItem[];
  total: number;
}

export interface QuickEntrySubmitRequest {
  id: string;
  name: string;
  isStored?: boolean;
}

export interface QuickEntrySubmitResponse {
  success: boolean;
  item: QuickEntryItem;
}

export interface OperationLog {
  id: string;
  operator: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface AIChatRequest {
  message: string;
  userId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    items?: Array<{ id: string; name: string; isStored: boolean; signalStrength: number }>;
    weather?: string;
    schedule?: string;
  };
  temporaryCarryItems?: string[];
}

export interface AIChatResponse {
  reply: string;
  matchedItem?: { id: string; name: string; isStored: boolean; location: string };
  matchedItems?: Array<{ id: string; name: string; reason: string; isStored: boolean; signalStrength: number; location: string }>;
  intent?: 'find_items' | 'register_item' | 'name_item' | 'chat' | 'daily_items' | 'schedule_add' | 'schedule_query' | 'schedule_delete' | 'carry_remind';
  registerItemName?: string;
  namedItem?: { id: string; name: string; isStored: boolean; location: string };
  scheduleEvents?: Array<{ title: string; date: string; startTime: string; endTime: string; location: string; tag: ScheduleTag }>;
  deletedSchedules?: Array<{ id: string; title: string; date: string; startTime: string }>;
  scheduleRecommendations?: Array<{ id: string; name: string; isStored: boolean; location: string; reason: string }>;
  temporaryCarryItems?: string[];
}

export interface AIDailyRecommendResponse {
  items: Array<{ id: string; name: string; reason: string; isStored: boolean }>;
  summary: string;
}

export type PetType =
  | 'white_rabbit'
  | 'orange_fox'
  | 'gray_white_cat'
  | 'red_panda'
  | 'shiba'
  | 'blue_smurf'
  | 'green_frog'
  | 'yellow_duck'
  | 'pink_pig'
  | 'brown_bear'
  | 'purple_monster'
  | 'white_seal'
  | 'orange_hamster'
  | 'cyan_dragon'
  | 'gray_penguin';

export interface PetProfile {
  petType: PetType;
  level: number;
  intimacy: number;
  nextLevelIntimacy: number;
  lastFeedTime: string | null;
  lastPlayTime: string | null;
  mood: 'happy' | 'normal' | 'sad';
  ttsEnabled: boolean;
}

export interface UserProfileInfo {
  name: string;
  role: string;
  joinDate: string;
  email?: string;
  avatarUrl?: string;
}

export interface ModelConfig {
  baseUrl: string;
  modelName: string;
  apiKeyMasked: string;
  lastTestTime: string | null;
  lastTestSuccess: boolean | null;
}

export interface ModelConfigUpdate {
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

export interface BaseStationConfig {
  location: string;
  locationName: string;
  strongSignalThreshold: number;
}

export interface BaseStationConfigUpdate {
  location?: string;
  strongSignalThreshold?: number;
}

export function inferRoomFromSignal(
  isStored: boolean,
  signalStrength: number,
  baseStationLocation: string,
  strongThreshold: number,
): string {
  if (!isStored) return '未存入';
  const otherRoom = baseStationLocation === '客厅' ? '卧室' : '客厅';
  return signalStrength >= strongThreshold ? baseStationLocation : otherRoom;
}

export type ScheduleTag = 'work' | 'travel' | 'life' | 'other';
export type ScheduleStatus = 'pending' | 'completed' | 'cancelled';

export interface Schedule {
  id: string;
  title: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
  tag: ScheduleTag;
  status: ScheduleStatus;
  description: string | null;
}

export interface ScheduleListResponse {
  items: Schedule[];
}

export interface ScheduleCreateRequest {
  title: string;
  scheduleDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  tag?: ScheduleTag;
  status?: ScheduleStatus;
  description?: string;
}

export interface ScheduleUpdateRequest {
  title?: string;
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  tag?: ScheduleTag;
  status?: ScheduleStatus;
  description?: string;
}

export interface ScheduleDayDot {
  date: string;
  count: number;
}

export interface ScheduleParseRequest {
  text: string;
  baseDate?: string;
}

export interface ScheduleParsedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  tag: ScheduleTag;
}

export interface ScheduleParseResponse {
  events: ScheduleParsedEvent[];
  reply: string;
}

export interface ScheduleRecommendRequest {
  date: string;
}

export interface ScheduleRecommendItem {
  id: string;
  name: string;
  isStored: boolean;
  location: string;
  reason: string;
}

export interface ScheduleRecommendResponse {
  items: ScheduleRecommendItem[];
  summary: string;
}
