# 复制 / 分享 / Toast 交互约定（Copy · Share · Toast Convention）

> 统一「复制链接 / 分享 / 反馈提示」的交互范式，先在 aak 落地，作为跨站约定
> （CROSS_REPO_INTEGRATION.md B3）供 CLS、hthp、akreader 照此实现。

## 1. 复制链接按钮

- **入口**：内容行（如 aak 盒头 `.box-id-line` 右侧的 `.box-copy-link` 图标按钮）、
  工具栏「复制当前链接」、筛选对话框 footer、空状态引导。
- **文案**：`title` / `aria-label` 直接内插内容 id，例如「复制 52.0 盒链接」。
- **行为**：点击后复制规范 URL `https://<origin>/#<token>`，按钮图标 1.2s 内切换为
  `Check` 反馈。

## 2. 剪贴板写入（aak 范式：`src/lib/clipboard.ts`）

```ts
import { copyText } from '@/lib/clipboard'

const ok = await copyText('https://aak.nslc.top/#52')
```

- 优先 `navigator.clipboard.writeText`（secure context）。
- 失败 / 不可用（非安全上下文、权限拒绝）→ 回退 `execCommand('copy')`。
- 两者都失败返回 `false`：调用方 toast 展示 URL 供手动复制，**绝不静默失败**。

## 3. Toast 反馈（aak 范式：`App.vue showToast`）

- 成功：`已复制 #52`（含 token，简短可识别）。
- 失败：`复制失败：<完整 URL>`（把 URL 放进 toast，用户可手动复制）。
- 统一气泡样式 `.toast-bubble`，约 2.6s 自动消失，`role="status"` 无障碍播报。

## 4. 入站解析接线约定（load + hashchange 两处）

深链分享的**入站解析**必须同时接线两处（aak 的 `applyUrlState` + `onHashChange`）：

1. **首载（load）**：解析 URL 路由 / `#p=` 载荷，应用视图并滚动 / 高亮目标。
2. **hashchange**：用户在已打开页面改地址栏 / 点击站内跳转时重新解析。

`#p=` 口袋分享只在首载导入（已打开页面需刷新），与路由 `&` 段共存。

## 5. 分享载荷（`#p=`，aak 范式：`src/lib/share.ts`）

- 用 fflate 压缩 JSON（`{version, pocketName, items, sourceHash}`），base64url 编码为
  `#p=<payload>`。
- 接收端创建 / 合并同名口袋、去重、保留失效项、导入后清空 hash。
- 仅包含当前口袋，不含盒筛选（筛选走路由 `#` 段）。

## 6. 落地状态

- **aak**：已落地（盒头复制按钮、工具栏复制当前链接、筛选对话框复制、空状态引导、
  `clipboard.ts`、toast 范式、`?theme=` 入站参数）。
- **其它站点**：照抄本约定实现「按钮 + `navigator.clipboard` + toast」，并把入站解析
  接线到 load + hashchange 两处。详见 `docs/deep-links.md`。
