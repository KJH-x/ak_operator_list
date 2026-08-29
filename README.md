# 明日方舟通行认证图鉴

部署于 `aak.nslc.top` 的本地优先静态图鉴。页面只读取仓库中的 `public/data/catalog.v2.json` 和 `public/data/images.v2.json`；收藏、排序、主题、头像尺寸和分享导入均在浏览器本地完成。运行时唯一的外部跳转是用户在浏览模式主动打开的 PRTS 页面。

## 功能特性

- **稀有度头像边框**：头像按干员稀有度渲染渐变描边 —— 6★ 红金流光动画、5★ 实心金、4★ 紫→白、3★ 及以下淡白→透明；无稀有度（非实装角色，如博士/12f/ACE 等）保持默认灰边。稀有度来自游戏 `character_table` 的 `TIER_1~TIER_6`，随 `catalog.v2.json` 的 `rarity` 字段下发（431 名干员中 407 名有稀有度）。样式备选方案见 `rarity-border-style-guide.html`（本地静态对比页，可点击选择后让维护者切换实现）。
- **两层可折叠工具栏**：第一行为品牌与折叠按钮，第二行收纳全部视图控件（搜索、系列筛选/排序依据下拉、盒款筛选、参考价开关、收藏/浏览、按盒/按干员、主题、头像尺寸、逆序），默认展开，可整体折叠；折叠按钮带顺时针旋转动画（480ms）。
- **自定义下拉菜单**：系列筛选与排序依据使用统一的自定义下拉（`src/components/DropdownSelect.vue`），带展开/收起缓动动画、键盘支持（Esc 关闭、方向键移动、Enter 选中）与选中复选标记。
- **参考价切换**：价格面板瞬时展开/收起（无动画——曾用 577 个面板的高度过渡，逐帧重排导致卡顿，已取消），切换时自动锚定当前可见位置（顶栏底部），页面不因行高变化跳动。
- **口袋面板**：跟随顶栏展开/折叠上下浮动；通过分享链接或 JSON 文件导入时，若项目已存在会显示短暂气泡提示。
- **数据质量**：`catalog-v2.mjs` 对名字做大小写不敏感的唯一次元数据兜底匹配（如 `12f`→`12F`、白名单 `MISERY`→`Misery`），恢复英文名、PRTS 链接与稀有度；白名单凭证中 6 名可实装干员已补充头像（R2）。
- **搜索**：占位符为「拼音 / 英文」，支持中文、英文、全拼、首字母与拼音检索。
- **URL 路由导航**：可用 `#52`（或 `/52` 路径形式，经 `_redirects` 回退到 index）直接打开指定盒款筛选，多盒以 `+` 连接（如 `#52+50+7`），特殊盒用百分号编码的完整 id，`&type=` 限定系列类型、`&q=` 携带搜索词，`#none` 表示不显示任何盒；手动筛选/搜索时地址栏经 `history.replaceState` 同步为规范 hash（搜索约 300ms 防抖），分享 token `#p=` 可在独立 `&` 段与路由共存。

## 路由与已知故障（风险）

- **SPA 回退掩盖 404**：`public/_redirects` 的 `/* /index.html 200` 使一切未知路径（拼写错误、旧链接）都返回页面而非 404；仅当请求未命中真实静态文件时生效。若该文件未随 `dist` 部署（vite 会把 `public/` 复制到 `dist/`，部署后应确认 `dist/_redirects` 存在），`/52` 路径形式会直接 404。
- **路由覆盖本地保存的筛选**：页面加载时 URL 路由优先于 localStorage 中保存的盒筛选，并会把解析结果写回 localStorage；打开带旧路由的分享链接会静默改变已保存的筛选。
- **`#p=` 分享只解析一次**：分享载荷必须在独立的 `&p=` 段才能与路由共存；`#p=` 导入只在首次加载时执行，已打开的页面上粘贴分享链接需刷新页面才会导入；畸形组合 URL 可能解析异常（分享载荷含 `+`/`&` 会被破坏）。
- **`#none` 与无效 token**：`#none` 表示“一盒都不显示”的特殊状态；无法解析的 token（拼写或编码错误）会被静默丢弃并回退为默认（显示全部盒），不报错也不提示。
- **搜索同步噪声**：每次输入经约 300ms 防抖后用 `replaceState` 重写地址栏，不产生历史记录；地址栏会包含搜索词（`&q=`），分享链接可能暴露搜索内容。
- **`type=` 取值受限**：只接受 `numeric/ambience/cooperation/special/whitelist`，其他值被忽略并按“全部系列”处理。
- **编码一致性**：特殊盒名在路由中按 `encodeURIComponent` 编码、解析时 `decodeURIComponent`；地址栏手输未编码中文可能无法匹配。数字盒 `52`/`52.0` 均接受，且只匹配 numeric 类型（如 `白名单凭证1.0` 不会被当作数字盒 1.0）。
- **反向同步只写 hash**：手动筛选后地址栏统一规范化为根路径 + hash（如 `/#52+50+7`）；`/52` 路径形式只是输入入口，加载时会被重写为 `/#52`。
- **边缘缓存收敛**：CF 边缘可能在新部署后短暂返回旧资源或旧 `_headers`，路由与 `_redirects` 行为会自动收敛；部署后应抽查 `/52` 与 `/data/catalog.v2.json`。
- **路径/静态文件优先级**：真实静态文件优先于 catch-all 重定向，`/data/*`、`/assets/*` 不受影响。

## 本地开发

```powershell
npm install
npm run dev
```

生产构建只需要已提交的快照：

```powershell
npm run build
```

Cloudflare Pages 输出目录为 `dist`，不需要 R2 写权限。

## 维护刷新

默认盒数据维护源为 `../../AnAgent/workspace/page`，可用 `PASS_DATA_WORKSPACE` 覆盖。Ak-Data 可用 `AK_DATA_WORKSPACE` 指向包含 `data/wiki_list.csv` 的目录；缺失时刷新器按配置的 raw fallback 和本地缓存尝试补充。PRTS 页面和首次入游日期只从维护者缓存读取，页面加载不会抓取外站。

完整刷新顺序为：更新盒数据、更新 Ak-Data 元数据缓存、读取 PRTS 日期缓存、下载并按 SHA-256 去重图片、生成 tiny/compact/display/original 四档资源、原子生成 v2 manifest 与 catalog、单元测试和构建。任一阶段失败都会恢复上一对公开 v2 快照。设置 `$env:PRTS_METADATA_FETCH = '1'` 时还会通过本地浏览器代理（端口 8932）重新抓取 PRTS“干员上线时间一览”并写回缓存。

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '<account-id>'
$env:R2_ACCESS_KEY_ID = '<access-key-id>'
$env:R2_SECRET_ACCESS_KEY = '<secret-access-key>'
$env:R2_BUCKET = 'ak-pass-assets'   # 必须是图鉴资源桶，不是 cls-page-data
$env:R2_PUBLIC_BASE_URL = 'https://aak-assets.nslc.top'
npm run refresh
```

刷新器会校验 `R2_BUCKET` 必须是 `ak-pass-assets`（除非显式设置 `R2_ALLOW_ANY_BUCKET=1`），避免把图鉴资源写进其他桶。R2 对象键为 `sha256/{hash}/original`、`tiny.webp`、`compact.webp`、`display.webp`。刷新器先 `HEAD`，已有哈希不会重复上传；原图和密钥都不会写入 Git。部署和提交仍需维护者人工确认。

## 部署（人工确认）

构建产物 `dist/` 是唯一部署内容，Cloudflare Pages 构建命令保持 `npm run build`：

```powershell
git add -A
git commit -m "feat: v2 local-first catalog with PRTS dates and pocket sharing"
git push
```

推送到 `master` 会自动触发 Cloudflare Pages 构建并上线 `aak.nslc.top`（2026-08-20 已验证）。`npm run deploy` 是备选直传方式：从项目本地 `.env` 读取 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`，直接上传 `dist/` 到 `ak-operator-list` Pages 项目，不依赖 shell 环境变量。该 token 需要 Account → Cloudflare Pages → Edit 与 Account Settings → Read 权限（仅有 R2 桶读写不够）。部署前可用 `npm run preview` 做一次本地生产预览，确认 `/data/catalog.v2.json` 返回 `application/json`。

## 数据与权利

盒款数据来自 [ArknightsAuthorization_Series](https://gitcode.com/huangjinzhou1/ArknightsAuthorization_Series)，其数据说明采用 CC BY-NC 4.0。角色、敌人和商品图片权利归各自权利方，本站仅作非商业资料索引，并在快照中保留来源字段。
