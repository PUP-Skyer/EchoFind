AI+硬件 - EchoFind - 极致创科

# EchoFind 寻物 AI

EchoFind 是极致创科团队在「AI+硬件」赛道提交的寻物 AI 项目。

## 项目简介

EchoFind 通过 ESP32 贴纸（寻物标签）与飞书多维表格联动，实现物品定位、设备管理与异常告警。本仓库为项目的 **Web 中控台**，用于监控 ESP32 贴纸 → 飞书多维表格的整条数据传输链路，管理物品与设备，发现异常告警，并提供小寻 AI 助手（语音对话 / 物品识别 / 语音播报）与宠物陪伴等能力。

## 技术栈

- 前端：React 19 + TypeScript + Tailwind CSS + shadcn/ui + ReactECharts
- 后端：NestJS 10 + Drizzle ORM + Postgres
- 数据底座：飞书多维表格「物品信息表」（配置未就绪时使用 mock 数据）
- 硬件链路：ESP32 贴纸 → 飞书多维表格

## 目录结构

```
client/   Web 前端（中控台 / 管理端）
server/   NestJS 后端（items/devices/alerts/stats/settings 等模块）
shared/   前后端共享类型
```

## 本地运行

```bash
npm install
npm run dev
```

> 说明：为保护选手原创版权，本仓库仅提交可公开的源码与配置，不含环境变量（.env）、依赖目录（node_modules）与构建产物（dist）。部分内部测试与验证记录亦未包含。
