# 深链约定（Deep-Link Conventions）

> 本文档把 aak 的盒路由（`box-route`）定为**跨站内容级深链的基线标准**，供导航页、
> `BOX_CHARACTERS.md`、CLS、akreader、hthp 等下游站点统一遵循。对应
> `feature-audit-20260829/CROSS_REPO_INTEGRATION.md` 的 B1 / B2 / A2 约定。

## 0. 范围

本仓库 `aak.nslc.top` 是唯一已落地内容级深链的站点。深链 = 一个 URL 能打开并直接定位到
一个可消费的内容单元（盒、盒内角色、行、段落）。基线标准见下。

## 1. 内容单元：盒（Box）

aak 的盒路由是跨站唯一可复制的盒级深链。

| 形态 | 示例 | 说明 |
|---|---|---|
| 单盒 hash | `https://aak.nslc.top/#52` | 数字盒 `52.0` → token `52`（去 `.0` 后缀） |
| 单盒 path | `https://aak.nslc.top/52` | 输入入口，加载时重写为 `/#52` |
| 多盒 | `https://aak.nslc.top/#52+50+7` | 多个 token 用 `+` 连接 |
| 系列筛选 | `https://aak.nslc.top/#52&type=numeric` | `&` 分隔独立段 |
| 搜索词 | `https://aak.nslc.top/#52&q=%E9%98%BF%E7%B1%B3%E5%A8%85` | `q=` 携带 URL 编码的搜索词 |
| 空选择 | `https://aak.nslc.top/#none` | 一盒都不显示 |
| 分享共存 | `...#p=<payload>&52` | `#p=` 口袋载荷在独立 `&` 段与路由共存 |
| 干员深链 | `https://aak.nslc.top/#52&op=3` | 定位 52.0 盒第 3 槽位角色；或 `&c=<名字>` |

## 2. token 规范（唯一权威）

以 `src/lib/boxRoutes.ts` 的 `boxToToken` / `tokenToBoxId` 为准（单一事实源）：

- 数字盒（`/^\d+\.0$/`）：token 去掉 `.0` 后缀。`52.0` → `52`。
- 非数字盒（特殊盒 / 联动 / 音律 / 白名单）：`encodeURIComponent(完整 id)`。
  - `特别通行认证` → `%E7%89%B9%E5%88%AB%E9%80%9A%E8%A1%8C%E8%AE%A4%E8%AF%81`
  - `ManiFesto:` → `ManiFesto%3A`（含冒号）
  - `CanNot Wait For` → `CanNot%20Wait%20For`（含空格）
- 多盒 token 用 `+` 连接，`type=` / `q=` / `op=` / `c=` 用 `&` 作为独立段。
- 解析时 `decodeURIComponent`；数字盒只匹配 `numeric` 类型（`白名单凭证1.0` 不会被当作数字盒 1.0）。

**消费规则**：任何站点需要引用盒深链，一律读 `https://aak.nslc.top/data/box-routes.json`
（A2 单一事实源，见 §5），不得手写 token 以免漂移。

## 3. 干员级深链（盒内角色定位）

`#<boxToken>&op=<slot>` 或 `#<boxToken>&c=<名字>`（`c=` 需 URL 编码）：
- 解析后高亮并滚动到对应 `OperatorCard`（类 `route-target-op`）。
- 无效 slot / 名字回退到盒级并仅滚动到盒行。
- 与 `#p=` 共存不受影响（`parseUrl` 剥离 `p=` 段）。

## 4. 路由语义与解析接线

- 入站解析在 **load + hashchange 两处接线**（`App.vue` 的 `applyUrlState` / `onHashChange`）。
- 反向同步只写 hash：手动筛选后地址栏规范化为根路径 + hash（`/#...`）。
- 未知 token 不静默：`parseBoxRouteStrict` 暴露 `unknownTokens`，toast 提示。
- `_redirects` catch-all 使 `/52` 这类 path 形式回退到 index（SPA 掩蔽 404）。

## 5. 单一事实源产物 `data/box-routes.json`

由 `scripts/build-box-routes.mjs` 从已构建的 `catalog.v2.json` 生成（token 规则与
`boxToToken` 严格对齐），含 `schema_version` / `generated_at` / `source_version` 与 `rows`：

```json
{
  "schema_version": 1,
  "generated_at": "…",
  "source_version": "v1.9.1.8",
  "rows": [
    { "box_id": "1.0", "box_type": "numeric", "character_count": 8, "token": "1", "route": "https://aak.nslc.top/#1" }
  ]
}
```

`BOX_CHARACTERS.md` 与导航页卡片 routes 统一从此文件消费。

## 6. 其它站点的深链现状与目标（跨站 B1）

| 站点 | 现状 | 目标 |
|---|---|---|
| aak | 已落地（本文件 §1–§5） | 基线标准 |
| CLS_PAGE | 路径 `/ak/` `/ak-figures/` `/ef/` `/ef-figures/`，`/to/{slug}/` 半残 | 统一 slug token（`contentful` / `fullText`），Rank 2 修改 |
| hthp-patent | 无任何深链，`#q=xx&year=2026` 计划中 | `#q=` + `&pn=` 语法同步 |
| akreader | `/story/{category}/{activityCode}/{id}/`，无行锚点 | `#L{lineNumber}` 行锚点 |
| md-editor | 文档用户私有 IndexedDB，无法深链 | 不做内容深链 |

跨站约定：内容深链优先用 `hash`（`#52`、`#q=xx`、`#L120`、`#id-{id}`），
只在无法用 hash 时用 path。主题/视图类状态用 `?theme=` 参数（见 README「路由与已知故障」与
CROSS_REPO_INTEGRATION B2）。
