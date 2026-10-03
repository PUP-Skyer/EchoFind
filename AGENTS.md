# EchoFind 中控台 · 研发规范

## 产品定位

EchoFind 是寻物 AI 项目的 Web 中控台，用于监控 ESP32 贴纸 → 飞书多维表格的整条数据传输链路，管理物品与设备，发现异常告警。

## 技术栈

- 前端：React 19 + TypeScript + Tailwind CSS + shadcn/ui
- 后端：NestJS 10 + Drizzle ORM + Postgres
- 图表：ReactECharts
- 图标：lucide-react
- 数据底座：飞书多维表格「物品信息表」（配置未就绪时用 mock 数据）

## 设计规范

### 色彩系统（紫色主调，参考 Coursue 仪表盘）

| Token | 色值 | 用途 |
|-------|------|------|
| primary | `#6C5CE7` | 主色：导航选中、主按钮、重点强调 |
| primary-light | `#A29BFE` | 主色浅：悬停、次级强调 |
| primary-dark | `#5B4CDB` | 主色深：按下态 |
| success | `#00B894` | 在线/正常/成功 |
| warning | `#FDCB6E` | 告警/阻隔/警告 |
| danger | `#E17055` | 严重/低电/离线 |
| info | `#74B9FF` | 提示/信息 |
| bg-page | `#F5F6FA` | 页面背景（极浅灰蓝） |
| bg-card | `#FFFFFF` | 卡片背景 |
| bg-sidebar | `#FFFFFF` | 侧边栏背景 |
| text-primary | `#2D3436` | 主文字 |
| text-secondary | `#636E72` | 次文字 |
| text-muted | `#B2BEC3` | 辅助文字 |
| border | `#DFE6E9` | 边框 |

### 布局

- 左侧固定导航栏：240px 宽，白色背景
- 顶部栏：64px 高，搜索框 + 通知 + 用户
- 主内容区 + 右侧统计面板（概览/数据流页显示）
- 内容区最大宽度自适应，内边距 24px
- 卡片统一圆角 16px，阴影 `0 2px 12px rgba(0,0,0,0.03)`
- 区块间距 20px

### 排版

- 页面标题：text-2xl / font-semibold
- 卡片标题：text-lg / font-semibold
- 正文：text-sm / text-base
- 辅助文字：text-xs / text-muted

### 导航菜单项

1. 概览 Dashboard — LayoutDashboard
2. 数据流 Data Flow — Activity
3. 物品管理 Items — Package
4. 设备管理 Devices — Radio
5. 告警日志 Alerts — AlertTriangle
6. 统计看板 Statistics — BarChart3
7. 设置 Settings — Settings

### 组件约定

- 状态灯：8px 圆点 + 发光效果，绿=在线，橙=阻隔/告警，红=低电/严重，灰=离线
- 统计卡：图标圆形背景 + 数值 + 标签
- 列表：hover 浅灰背景，操作按钮右对齐

## 数据模型

### Item（物品）
- id: string（编号）
- name: string（物品名称）
- signalStrength: number（信号强度 0-100，2位小数）
- reportTime: string（上报时间 ISO）
- isStored: boolean（是否存入）
- imageUrl: string（物品图片 URL）
- deviceId: string（绑定贴纸编号）

### Device（贴纸设备）
- id: string（贴纸编号）
- status: 'online' | 'offline' | 'blocked' | 'low_battery'
- signalStrength: number
- battery: number（0-100）
- boundItemId: string | null
- lastSeen: string

### Alert（告警）
- id: string
- type: 'blocked' | 'low_battery' | 'offline' | 'abnormal'
- level: 'critical' | 'warning' | 'info'
- deviceId: string
- itemName: string
- message: string
- timestamp: string
- resolved: boolean

### DataFlow 状态
- esp32Status: 'connected' | 'disconnected'
- feishuStatus: 'connected' | 'disconnected'
- latency: number（ms）
- lastSyncTime: string

## 后端模块

- `items` — 物品 CRUD
- `devices` — 设备管理
- `alerts` — 告警日志
- `stats` — 统计数据
- `settings` — 飞书配置

所有模块先以 mock 数据实现，飞书配置就绪后可切换为真实 API。
