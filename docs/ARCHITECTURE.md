# Architecture

## Overview

AutoShift Planner 是一个基于 Nuxt 4 的排班规划应用，采用 SSR/ESR 架构，支持 PWA 离线使用。

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Nuxt 4 (Vue 3) | 全栈框架，SSR/ESR |
| Styling | UnoCSS | 原子化 CSS 引擎 |
| State | Pinia | Vue 状态管理 |
| Utils | VueUse + es-toolkit | 组合式工具 + 通用工具库 |
| Lint | @antfu/eslint-config | 代码规范 |
| Language | TypeScript | 类型安全 |
| PWA | @vite-pwa/nuxt | 离线支持 |
| Deploy | Netlify / Docker | 部署方案 |

## Directory Structure

```
AutoShift-Planner/
├── app/                    # 应用主目录
│   ├── components/         # Vue 组件 (PascalCase)
│   ├── composables/        # 组合式函数 (use* 前缀)
│   ├── config/             # 应用配置
│   ├── constants/          # 常量定义
│   ├── layouts/            # 布局组件
│   └── pages/              # 页面路由 (file-based routing)
├── server/
│   └── api/                # API 端点
├── public/                 # 静态资源
├── docs/                   # 文档
├── nuxt.config.ts          # Nuxt 配置
├── AGENTS.md               # Agent 工作指令
├── feature_list.json       # 功能状态追踪
├── progress.md             # 会话进度日志
└── init.sh                 # 初始化脚本
```

## Coding Conventions

- **Components**: `<script setup lang="ts">` + Composition API
- **Styles**: UnoCSS utility classes 优先，避免 `<style>` 块
- **Naming**: 组件 PascalCase，composables 用 `use` 前缀
- **Imports**: ES Modules only，无 `require`
- **Async**: `async/await` 优先，避免 Promise 链
- **No semicolons**: 遵循 @antfu/eslint-config

## Data Flow

(待定义 — 随功能开发逐步补充)

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Nuxt 4 + SSR | SEO 友好 + 首屏性能 |
| UnoCSS | 零运行时、高性能原子化 CSS |
| Pinia | TypeScript 原生支持的 Vue 状态管理 |
| File-based routing | Nuxt 默认路由方案，约定优于配置 |
