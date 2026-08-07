# Implementation Progress

Goal: 将现有 aak.nslc.top 静态图鉴升级为一个完全本地优先的收藏与浏览工具：用户可以在收藏模式中快速添加精1/精2状态款，在浏览模式中直接进入正确的 PRTS 页面，按盒、按时间或按干员首次入游日期查看内容，用中文、英文、全拼和首字母搜索，并通过不依赖后端的紧凑分享链接把当前口袋安全地合并到另一台设备；所有数据、图片、排序、主题和尺寸偏好在本地复用，刷新只在维护者执行命令时访问外部数据源。

## Current Snapshot

- `catalog.v2.json`: source hash `498baae85a2169bb6ec264a918a7281e8cc962c9644f9ec5dcb782742cd5b120`; 92 boxes, 577 memberships, 902 state variants, 431 distinct operator IDs. Undifferentiated copies (no valid prices for both ELITE1/ELITE2) are represented as a single ELITE1 variant.
- Release-date coverage: 551 of 577 memberships carry `operatorReleaseDate` from the cached PRTS “干员上线时间一览” snapshot; unknown dates stay explicit `null` and sort last.
- PRTS page coverage: 557 of 577 memberships have `prtsPageUrl`; special/NPC records use the explicit override table and never append display suffixes.
- `images.v2.json`: 506 source URLs, 505 content hashes; `original`, `tiny.webp`, `display.webp`, and `compact.webp` were uploaded to R2 and verified with S3 `HEAD` and public GET.
- Ak-Data metadata cache: `operator-metadata.json` rebuilt from `wiki_list.csv` + game tables (1202 records); `prts-metadata.json` holds 456 parsed release-date rows.
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
| Unit and Playwright acceptance coverage | complete | 27 unit tests and 21 e2e tests green across 1440x900, 1024x768, 390x844 |

## Verification Log

- `npm run typecheck`: passed 2026-08-07.
- `npm run test:unit`: passed 27 tests 2026-08-07.
- `npm run test:e2e`: passed 21 tests (7 scenarios x 3 viewports) 2026-08-07, including zero serious/critical axe violations.
- `npm run build`: passed 2026-08-07.
- `npm run refresh` with R2 credentials and `PRTS_METADATA_FETCH=1`: passed 2026-08-07; the full ordered pipeline ran (workspace → Ak-Data cache → PRTS date fetch → asset sync → v2 snapshots → unit tests → build), and `original`, `tiny.webp`, `display.webp`, `compact.webp` were verified with S3 `HEAD`.
- Production preview smoke: `vite preview` served `/`, `/data/catalog.v2.json`, and hashed assets with HTTP 200; `dist/data/catalog.v2.json` exactly matches the published public snapshot (same `generatedAt` and source hash).
- Deployment: `npm run deploy` published `dist` to Pages project `ak-operator-list` on 2026-08-07; `aak.nslc.top` now serves v2 (92 boxes / 577 records), and a real-browser live check confirmed `AMY` search returns 阿米娅 across 10 boxes.
- R2 bucket corrected: credentials now come from project-local `.env` (`R2_BUCKET=ak-pass-assets`, `R2_PUBLIC_BASE_URL=https://aak-assets.nslc.top`); `ak-pass-assets` has all four object kinds and `aak-assets.nslc.top/.../compact.webp` returns 200.
- Follow-up fixes verified live: disabled ELITE2 zone opacity is 0 until hover and 1 on hover; compact mode uses 68px grid columns with 8px gap, 52x52 portraits, hidden box/operator names; dark theme covers topbar and pocket header; operator view shows only “入游时间” and unknown dates stay last; metadata cache refuses regressions below 500 records.
- Compact hover icons: elite1/elite2 are embedded as base64 WebP data URIs (64x42 / 64x53, ~1.8KB/2.7KB) with explicit 24x16/24x20 display sizes; no runtime request to `static.prts.wiki` for icons.
- Lockfile fix: regenerated `package-lock.json` so sharp's optional platform packages (ppc64/riscv64/win32-arm64) are present; `npm ci` passes cleanly and Pages GitHub builds no longer fail with `Invalid Version`.
- Deployment and Git push: not performed; `aak.nslc.top` still serves v1 until the maintainer deploys `dist` and commits.

## Open Gaps / Next Steps

- Git commit and push remain manual (no GitHub credentials were provided); `npm run deploy` is ready for future updates and reads credentials only from `.env`.
- `aak.nslc.top` edge caches may briefly serve older headers/assets after a new deployment; the new deployment URL and the next refresh cycle will converge automatically.
- Re-run `npm run metadata:cache` and `npm run prts:dates` whenever Ak-Data or PRTS metadata changes, then regenerate snapshots with `npm run snapshot`.
- Review the 26 undated special/NPC records and fill the override table only from reliable sources; do not invent dates.
