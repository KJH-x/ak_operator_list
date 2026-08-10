# Implementation Progress

Goal: 将现有 aak.nslc.top 静态图鉴升级为一个完全本地优先的收藏与浏览工具：用户可以在收藏模式中快速添加精1/精2状态款，在浏览模式中直接进入正确的 PRTS 页面，按盒、按时间或按干员首次入游日期查看内容，用中文、英文、全拼和首字母搜索，并通过不依赖后端的紧凑分享链接把当前口袋安全地合并到另一台设备；所有数据、图片、排序、主题和尺寸偏好在本地复用，刷新只在维护者执行命令时访问外部数据源。

## Current Snapshot

- `catalog.v2.json`: source hash `498baae85a2169bb6ec264a918a7281e8cc962c9644f9ec5dcb782742cd5b120`; 92 boxes, 577 memberships, 902 state variants, 431 distinct operator IDs. Undifferentiated copies (no valid prices for both ELITE1/ELITE2) are represented as a single ELITE1 variant.
- Rarity coverage: 407 of 431 operator IDs carry `rarity` (1–6, from game `character_table` `TIER_1~TIER_6`); the remaining 24 are non-playable (博士/12f/ACE/SCOUT/OUTCAST/MANTRA/TULIP/霜星/塔露拉/杰斯顿/克丽斯腾/爱国者/士兵/大帝) and stay `null`. Every character now exposes `rarity` for the gradient avatar ring.
- Case-insensitive metadata fallback: `catalog-v2.mjs` resolves names that differ only by case to a unique metadata record (`12f`→`12F`/`char_009_12fce`, whitelist `MISERY`/`MECHANIST`/`RAIDIAN`/`PITH`/`STORMEYE`/`TOUCH`/`SHARP`→their real operators), restoring latin names, PRTS pages and rarity.
- Whitelist avatars: 6 playable whitelist operators (MISERY, MECHANIST, RAIDIAN, PITH, STORMEYE, TOUCH, SHARP) now have avatars; ACE/SCOUT/OUTCAST/MANTRA/TULIP have no PRTS avatar and keep the placeholder.
- Release-date coverage: 551 of 577 memberships carry `operatorReleaseDate` from the cached PRTS “干员上线时间一览” snapshot; unknown dates stay explicit `null` and sort last.
- PRTS page coverage: 557 of 577 memberships have `prtsPageUrl`; special/NPC records use the explicit override table and never append display suffixes.
- `images.v2.json`: 512 source URLs; `original`, `tiny.webp`, `display.webp`, and `compact.webp` were uploaded to R2 and verified with S3 `HEAD` and public GET.
- Ak-Data metadata cache: `operator-metadata.json` rebuilt from `wiki_list.csv` + game tables (1202 records, including `rarity`); `prts-metadata.json` holds 456 parsed release-date rows.
- v1 snapshots remain in `public/data/catalog.v1.json` and `public/data/images.v1.json` for rollback.

## Decisions Confirmed

- Default mode is 收藏; browse mode only opens explicit PRTS pages and never shows an image modal.
- Share payload is version 1 in `#p=`, compressed with fflate, and contains only the current pocket. The receiving device creates or merges a same-name pocket, de-duplicates keys, keeps stale keys, and clears the hash after import.
- Unknown operator dates and unavailable PRTS mappings are explicit `null`; no runtime external metadata request is allowed.

## Stages

| Stage | Status | Evidence |
| --- | --- | --- |
| v2 catalog and image contracts | complete | `src/types.ts`, `scripts/catalog-v2.mjs`, local v2 snapshots |
| Ak-Data and PRTS maintenance enrichment | complete | `public/data/wiki_list.csv`, `public/data/operator-metadata.json`, `public/data/prts-metadata.json`, `scripts/fetch-prts-release-dates.mjs` |
| Atomic refresh and R2 compact upload | complete | `scripts/refresh.mjs`, `scripts/sync-assets.mjs`; refresh ran 2026-08-07, all four R2 kinds HEAD true |
| Search, stable sorting, operator aggregation | complete | `src/lib/search.ts`, `src/lib/pinyin.ts`, `src/lib/catalog.ts` |
| Collection/browse UI and local settings | complete | `src/App.vue`, toolbar/cards/settings panel |
| Pocket hash sharing and merge | complete | `src/lib/share.ts`, `src/lib/pockets.ts`, `PocketPanel.vue` |
| Rarity-gradient avatar borders | complete | `src/components/OperatorCard.vue`, `src/components/PocketPanel.vue`, `src/styles.css`, `rarity-border-style-guide.html` |
| Two-layer collapsible toolbar + custom dropdowns | complete | `src/components/TopToolbar.vue`, `src/components/DropdownSelect.vue`, `src/styles.css` |
| Price-toggle slide animation with scroll anchoring | complete | `src/App.vue` (anchor at topbar bottom, 0 px drift open/close) |
| Unit and Playwright acceptance coverage | complete | 30 unit tests and 24 e2e tests green across 1440x900, 1024x768, 390x844 |

## Verification Log

- `npm run typecheck`: passed 2026-08-07 and 2026-08-10.
- `npm run test:unit`: passed 30 tests 2026-08-10.
- `npm run test:e2e`: passed 24 tests (8 scenarios x 3 viewports) 2026-08-10, including zero serious/critical axe violations.
- `npm run build`: passed 2026-08-07 and 2026-08-10.
- `npm run refresh` with R2 credentials and `PRTS_METADATA_FETCH=1`: passed 2026-08-07; the full ordered pipeline ran (workspace → Ak-Data cache → PRTS date fetch → asset sync → v2 snapshots → unit tests → build), and `original`, `tiny.webp`, `display.webp`, `compact.webp` were verified with S3 `HEAD`.
- Production preview smoke: `vite preview` served `/`, `/data/catalog.v2.json`, and hashed assets with HTTP 200; `dist/data/catalog.v2.json` exactly matches the published public snapshot (same `generatedAt` and source hash).
- Deployment: `npm run deploy` published `dist` to Pages project `ak-operator-list` on 2026-08-07; `aak.nslc.top` now serves v2 (92 boxes / 577 records), and a real-browser live check confirmed `AMY` search returns 阿米娅 across 10 boxes.
- R2 bucket corrected: credentials now come from project-local `.env` (`R2_BUCKET=ak-pass-assets`, `R2_PUBLIC_BASE_URL=https://aak-assets.nslc.top`); `ak-pass-assets` has all four object kinds and `aak-assets.nslc.top/.../compact.webp` returns 200.
- Follow-up fixes verified live: disabled ELITE2 zone opacity is 0 until hover and 1 on hover; compact mode uses 68px grid columns with 8px gap, 52x52 portraits, hidden box/operator names; dark theme covers topbar and pocket header; operator view shows only “入游时间” and unknown dates stay last; metadata cache refuses regressions below 500 records.
- Compact hover icons: elite1/elite2 are embedded as base64 WebP data URIs (64x42 / 64x53, ~1.8KB/2.7KB) with explicit 24x16/24x20 display sizes; no runtime request to `static.prts.wiki` for icons.
- Lockfile fix: regenerated `package-lock.json` so sharp's optional platform packages (ppc64/riscv64/win32-arm64) are present; `npm ci` passes cleanly and Pages GitHub builds no longer fail with `Invalid Version`.
- 2026-08-10 UI/data batch: rarity gradient rings verified per tier (6★ animated red-gold, 5★ solid gold, 4★ purple→white, 3★+ faint white; flow loop is pixel-seamless end-vs-start diff 0); two-layer collapsible toolbar + custom dropdown animations verified; price toggle keeps the anchor box at the topbar bottom with 0 px drift in both directions (Playwright measurement); pocket panel follows the toolbar height via `--topbar-height` ResizeObserver; dark+browse source icon is white-on-dark; duplicate-import toast fires for share and file imports; whitelist avatars load from R2 (`is-target` phase).
- Git push: performed 2026-08-10; deployment of the new `dist` to `aak.nslc.top` remains a manual `npm run deploy` step.

## Open Gaps / Next Steps

- `aak.nslc.top` edge caches may briefly serve older headers/assets after a new deployment; the new deployment URL and the next refresh cycle will converge automatically.
- Deployment of the 2026-08-10 `dist` build to `aak.nslc.top` is a manual `npm run deploy` step (the Git commit/push for this batch is done).
- Re-run `npm run metadata:cache` and `npm run prts:dates` whenever Ak-Data or PRTS metadata changes, then regenerate snapshots with `npm run snapshot`.
- Review the 26 undated special/NPC records and fill the override table only from reliable sources; do not invent dates.
