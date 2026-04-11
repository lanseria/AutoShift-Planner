# AGENTS.md

AutoShift Planner — 基于 Nuxt 4 的智能排班规划应用，目标是提供自动化排班、班次管理和团队协作功能。

## Startup Workflow

每次开始编码前，按顺序执行：

1. **Read this file** — 了解工作规则和边界
2. **Read `docs/ARCHITECTURE.md`** — 了解技术架构和目录约定
3. **Read `feature_list.json`** — 查看当前功能状态，选择一个未完成的功能
4. **Review recent commits** — `git log --oneline -5` 了解最近变更
5. **Run verification** — `pnpm lint && pnpm typecheck` 确认基线健康

如果基线验证失败，先修复再添加新功能。

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3, SSR/ESR, Composition API + `<script setup lang="ts">`)
- **Package Manager**: pnpm
- **Styling**: UnoCSS (utility-first，减少 `<style>` 块)
- **State**: Pinia
- **Utils**: VueUse (浏览器 API 封装), es-toolkit (通用工具)
- **Lint**: @antfu/eslint-config (无分号、单引号、尾随逗号)
- **Language**: TypeScript (严格模式，避免 `any`)

## Working Rules

- **One feature at a time** — 从 `feature_list.json` 中选择唯一一个未完成功能
- **Stay in scope** — 不修改与当前功能无关的文件
- **No speculative code** — 不添加未要求的功能、抽象或配置
- **Follow existing patterns** — 查看已有代码的风格和模式，保持一致
- **No semicolons, single quotes** — 严格遵循 @antfu/eslint-config
- **Composition API only** — 所有 Vue 组件使用 `<script setup lang="ts">`
- **UnoCSS utilities** — 优先使用 utility classes，避免自定义 CSS

## Scope Boundaries (DO NOT MODIFY WITHOUT ASKING)

- **不要** 修改 `nuxt.config.ts` 的核心配置（modules, experimental, future）
- **不要** 修改 `.github/workflows/` 下的 CI 配置
- **不要** 修改 `Dockerfile` 或 `netlify.toml`
- **不要** 添加未经确认的新依赖
- **不要** 修改或删除已有功能的工作代码（除非是明确的修复任务）

## Required Artifacts

| File | Purpose |
|------|---------|
| `feature_list.json` | 功能状态追踪（source of truth） |
| `progress.md` | 会话进度日志 |
| `init.sh` | 标准初始化和验证脚本 |
| `docs/ARCHITECTURE.md` | 架构文档 |

## Definition of Done

一个功能只有满足以下 **全部条件** 才算完成：

- [ ] 目标行为已实现
- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 成功
- [ ] 证据记录在 `feature_list.json` 或 `progress.md`
- [ ] 仓库保持可重启状态（下一个会话可以立即运行验证）

## End of Session

会话结束前必须执行：

1. Update `progress.md` — 记录当前状态和下一步
2. Update `feature_list.json` — 更新功能状态
3. Record blockers/risks — 记录未解决的阻塞或风险
4. Commit with descriptive message — 工作处于安全状态时提交
5. Leave clean state — 下次会话可以立即开始工作

## Verification Commands

```bash
# Full verification
pnpm lint && pnpm typecheck && pnpm build

# Individual checks
pnpm lint          # ESLint 检查
pnpm typecheck     # TypeScript 类型检查
pnpm build         # 生产构建
```

## Escalation

遇到以下情况时暂停并询问用户：

- **架构决策** — 涉及目录结构、数据流、组件划分的重大变更
- **需求不明确** — 功能定义模糊或存在歧义
- **验证反复失败** — 连续 3 次修复仍无法通过验证
- **范围蔓延** — 发现当前任务需要修改 scope boundaries 中的文件
- **依赖决策** — 需要引入新的第三方库
