<script setup lang="ts">
import { AlertTriangle, Copy, Database, LoaderCircle, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BoxFilterPanel from '@/components/BoxFilterPanel.vue'
import CatalogBoxRow from '@/components/CatalogBoxRow.vue'
import OperatorView from '@/components/OperatorView.vue'
import PocketPanel from '@/components/PocketPanel.vue'
import TopToolbar from '@/components/TopToolbar.vue'
import { aggregateOperators, buildVariantIndex, filterOperatorAggregates, sortBoxes } from '@/lib/catalog'
import { copyText } from '@/lib/clipboard'
import { applyBoxSelection, defaultBoxSelection, filterBoxes, loadBoxSelection, saveBoxSelection, type BoxSelection } from '@/lib/filters'
import { buildRouteHash, parseBoxRouteStrict, parseUrl } from '@/lib/router'
import { applyTheme, loadSettings, saveSettings, themeFromUrl } from '@/lib/settings'
import { decodeSharePayload } from '@/lib/share'
import { loadPocketState, mergeSharedPocket, savePocketState, sharedDuplicateCount, togglePocketItem } from '@/lib/pockets'
import type { AppSettings, CatalogSnapshot, PocketState } from '@/types'

const catalog = ref<CatalogSnapshot | null>(null)
const loadError = ref('')
const query = ref('')
const type = ref('all')
const showPrices = ref(false)
const mode = ref<'collect' | 'browse'>('collect')
const listView = ref<'boxes' | 'operators'>('boxes')
const filterOpen = ref(false)
const drawerOpen = ref(false)
const selection = ref<BoxSelection>(defaultBoxSelection())
const settings = ref<AppSettings>(loadSettings(window.localStorage))
const pockets = ref<PocketState>(loadPocketState(window.localStorage))
const notice = ref('')
const toast = ref('')
const backStack = ref<string[]>([])
const urlThemeOverride = ref(themeFromUrl(window.location.search))
let toastTimer: number | undefined
let routeTimer: number | undefined
let topbarObserver: ResizeObserver | null = null
let routeHighlightTimer: number | undefined
let suppressSync = false

function showToast(message: string) {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2600)
}

function syncTopbarHeight() {
  const topbar = document.querySelector<HTMLElement>('.topbar')
  if (topbar) {
    const height = topbar.getBoundingClientRect().height
    document.documentElement.style.setProperty('--topbar-height', `${height}px`)
  }
}

const typeLabels: Record<string, string> = {
  numeric: '数字盒', ambience: '音律系列', cooperation: '联动系列', special: '特别款', whitelist: '白名单凭证',
}

const variantIndex = computed(() => catalog.value ? buildVariantIndex(catalog.value) : new Map())
const currentPocket = computed(() => pockets.value.pockets.find((pocket) => pocket.id === pockets.value.currentPocketId) ?? pockets.value.pockets[0]!)
const activeItems = computed(() => new Set(currentPocket.value.items))
const typeOptions = computed(() => {
  const boxes = catalog.value?.boxes ?? []
  const values = [...new Set(boxes.map((box) => box.type))]
  return [{ value: 'all', label: '全部系列', count: boxes.length }, ...values.map((value) => ({ value, label: typeLabels[value] ?? value, count: boxes.filter((box) => box.type === value).length }))]
})
const filteredBoxes = computed(() => filterBoxes(catalog.value?.boxes ?? [], { query: query.value, type: type.value, selection: selection.value }))
const visibleBoxes = computed(() => sortBoxes(filteredBoxes.value, settings.value.sortBase === 'time' ? 'time' : 'category-time', settings.value.reversed))
const visibleOperators = computed(() => {
  const entries = aggregateOperators(filteredBoxes.value, settings.value.reversed)
  return filterOperatorAggregates(entries, query.value)
})
const visibleCharacters = computed(() => listView.value === 'operators'
  ? visibleOperators.value.reduce((sum, operator) => sum + operator.appearances.length, 0)
  : visibleBoxes.value.reduce((sum, box) => sum + box.characters.length, 0))
const boxSelectionLabel = computed(() => selection.value.custom ? `已选 ${selection.value.selectedIds.length} 盒` : '全部盒')
const canGoBack = computed(() => backStack.value.length > 0)

watch(pockets, (value) => savePocketState(window.localStorage, value), { deep: true })
watch(listView, (value) => {
  if (value === 'operators' && settings.value.sortBase !== 'operator-time') {
    settings.value = { ...settings.value, sortBase: 'operator-time' }
  } else if (value === 'boxes' && settings.value.sortBase === 'operator-time') {
    settings.value = { ...settings.value, sortBase: 'category-time' }
  }
})
watch(settings, (value) => {
  saveSettings(window.localStorage, value)
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  applyTheme(document.documentElement, urlThemeOverride.value ?? value.theme, prefersDark)
}, { deep: true })

watch(showPrices, async () => {
  if (!catalog.value) return
  const selector = listView.value === 'operators' ? '.operator-view-card' : '.box-row'
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
  const viewportHeight = window.innerHeight
  const topbarHeight = document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0
  let anchor: HTMLElement | null = null
  let best = Number.POSITIVE_INFINITY
  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > viewportHeight) continue
    const distance = Math.abs(rect.top - topbarHeight)
    if (distance < best) {
      best = distance
      anchor = element
    }
  }
  if (!anchor) return
  const initialTop = anchor.getBoundingClientRect().top
  await nextTick()
  const anchorDocumentTop = anchor.getBoundingClientRect().top + window.scrollY
  window.scrollTo(0, anchorDocumentTop - initialTop)
})

watch(selection, () => syncRoute('push'))
watch(type, () => syncRoute('push'))
watch(query, () => {
  if (routeTimer) window.clearTimeout(routeTimer)
  routeTimer = window.setTimeout(() => syncRoute('replace'), 300)
})

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === '/' && !isTypingTarget(event.target)) {
    const input = document.querySelector<HTMLInputElement>('.search-control input[type="search"]')
    if (input) {
      event.preventDefault()
      input.focus()
    }
  }
}

onMounted(async () => {
  selection.value = loadBoxSelection(window.localStorage)
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  applyTheme(document.documentElement, urlThemeOverride.value ?? settings.value.theme, prefersDark)
  syncTopbarHeight()
  const topbar = document.querySelector<HTMLElement>('.topbar')
  if (topbar && 'ResizeObserver' in window) {
    topbarObserver = new ResizeObserver(() => syncTopbarHeight())
    topbarObserver.observe(topbar)
  }
  try {
    const response = await fetch('/data/catalog.v2.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    catalog.value = await response.json() as CatalogSnapshot
    applyUrlState()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '未知错误'
  }
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  if (toastTimer) window.clearTimeout(toastTimer)
  if (routeTimer) window.clearTimeout(routeTimer)
  if (routeHighlightTimer) window.clearTimeout(routeHighlightTimer)
  topbarObserver?.disconnect()
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('keydown', onDocumentKeydown)
})

function applyUrlState() {
  if (!catalog.value) return
  const boxes = catalog.value.boxes
  const { sharePayload, route } = parseUrl(window.location.hash, window.location.pathname, boxes)
  suppressSync = true
  if (sharePayload) {
    try {
      const payload = decodeSharePayload(sharePayload)
      const duplicates = sharedDuplicateCount(pockets.value, payload)
      pockets.value = mergeSharedPocket(pockets.value, payload)
      notice.value = `已合并口袋“${payload.pocketName}”${payload.sourceHash !== catalog.value?.sourceHash ? '（数据版本不同，失效项目已保留）' : ''}`
      if (duplicates > 0) showToast(`已有 ${duplicates} 项已存在`)
    } catch {
      notice.value = '分享链接无效，未导入任何内容'
    }
  }
  if (route?.hasRoute) {
    selection.value = route.empty ? applyBoxSelection([])
      : route.boxIds.length ? applyBoxSelection(route.boxIds)
      : defaultBoxSelection()
    type.value = route.type
    query.value = route.query
    saveBoxSelection(window.localStorage, selection.value)
  }
  queueMicrotask(() => {
    suppressSync = false
    syncRoute('replace')
    revealBoxRoute(window.location.hash)
    warnUnknownTokens(window.location.hash)
  })
}

function syncRoute(mode: 'push' | 'replace' = 'replace') {
  if (suppressSync || !catalog.value) return
  const canonical = buildRouteHash(selection.value, type.value, query.value, catalog.value.boxes)
  const target = canonical ? `/${canonical}` : '/'
  const current = window.location.pathname === '/' && window.location.hash === canonical
  if (mode === 'push' && !current) {
    const prev = window.location.hash
    if (backStack.value[backStack.value.length - 1] !== prev) backStack.value.push(prev)
  }
  if (mode === 'push') window.history.pushState(null, '', target)
  else window.history.replaceState(null, '', target)
}

function onHashChange() {
  if (!catalog.value) return
  const boxes = catalog.value.boxes
  const { route } = parseUrl(window.location.hash, window.location.pathname, boxes)
  suppressSync = true
  if (route?.hasRoute) {
    selection.value = route.empty ? applyBoxSelection([])
      : route.boxIds.length ? applyBoxSelection(route.boxIds)
      : defaultBoxSelection()
    type.value = route.type
    query.value = route.query
    saveBoxSelection(window.localStorage, selection.value)
  }
  suppressSync = false
  revealBoxRoute(window.location.hash)
  warnUnknownTokens(window.location.hash)
}

/** A3/A6：进入/变更盒路由后：滚动到首个目标盒 + 高亮；干员级深链再定位角色卡 */
async function revealBoxRoute(hash: string) {
  if (!catalog.value || listView.value !== 'boxes') return
  const strict = parseBoxRouteStrict(hash, catalog.value.boxes)
  if (!strict?.hasRoute || strict.boxIds.length === 0) return
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  const firstId = strict.boxIds[0]!
  const heading = document.getElementById(`box-${firstId}`)
  const row = heading?.closest('.box-row')
  if (!row) return
  const topbarHeight = document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0
  const box = catalog.value.boxes.find((candidate) => candidate.id === firstId)
  const target = strict.operatorSlot != null || strict.operatorName
    ? box?.characters.find((character) => (
      character.slot === strict.operatorSlot || character.name === strict.operatorName
    ))
    : null
  const card = target
    ? Array.from(row.querySelectorAll<HTMLElement>('.operator-card'))
      .find((element) => element.getAttribute('aria-label')?.startsWith(target.name))
    : null
  if (card) {
    const top = card.getBoundingClientRect().top + window.scrollY - topbarHeight - 12
    window.scrollTo({ top, behavior: 'smooth' })
    card.classList.add('route-target-op')
    if (routeHighlightTimer) window.clearTimeout(routeHighlightTimer)
    routeHighlightTimer = window.setTimeout(() => card.classList.remove('route-target-op'), 2400)
  } else {
    const top = row.getBoundingClientRect().top + window.scrollY - topbarHeight - 12
    window.scrollTo({ top, behavior: 'smooth' })
    row.classList.add('route-target')
    if (routeHighlightTimer) window.clearTimeout(routeHighlightTimer)
    routeHighlightTimer = window.setTimeout(() => row.classList.remove('route-target'), 2400)
  }
}

/** C1：未知 token 提示 */
function warnUnknownTokens(hash: string) {
  if (!catalog.value) return
  const strict = parseBoxRouteStrict(hash, catalog.value.boxes)
  if (strict?.unknownTokens.length) {
    showToast(`链接中有无法识别的盒：${strict.unknownTokens.join('、')}`)
  }
}

function updateSelection(value: BoxSelection) {
  selection.value = value
  saveBoxSelection(window.localStorage, value)
  filterOpen.value = false
}

function toggleItem(key: string) {
  pockets.value = togglePocketItem(pockets.value, currentPocket.value.id, key)
}

function reloadPage() { window.location.reload() }

/** A4：复制当前多盒 + 筛选态完整链接 */
async function copyCurrentLink() {
  if (!catalog.value) return
  const canonical = buildRouteHash(selection.value, type.value, query.value, catalog.value.boxes)
  const url = `${window.location.origin}${canonical}`
  const ok = await copyText(url)
  showToast(ok ? `已复制当前链接 ${canonical || '(默认视图)'}` : `复制失败：${url}`)
}

/** A5：返回上一筛选（内存栈） */
function goBackFilter() {
  const target = backStack.value.pop()
  if (target === undefined) return
  if (target) {
    window.location.hash = target
  } else {
    suppressSync = true
    selection.value = defaultBoxSelection()
    type.value = 'all'
    query.value = ''
    suppressSync = false
    syncRoute('replace')
  }
}

/** A3：跳到盒 */
function handleJump(hash: string) {
  if (window.location.hash === hash) revealBoxRoute(hash)
  else window.location.hash = hash
}

/** C5：用户显式改主题后清除 URL 覆盖 */
function changeTheme(value: 'system' | 'light' | 'dark') {
  urlThemeOverride.value = null
  settings.value = { ...settings.value, theme: value }
}</script>

<template>
  <div class="app-frame" :class="{ 'avatar-compact': settings.avatarSize === 'compact' }">
    <TopToolbar
      v-model:query="query"
      v-model:type="type"
      v-model:show-prices="showPrices"
      v-model:mode="mode"
      v-model:list-view="listView"
      :sort-base="settings.sortBase"
      :reversed="settings.reversed"
      :theme="settings.theme"
      :avatar-size="settings.avatarSize"
      :types="typeOptions"
      :box-selection-label="boxSelectionLabel"
      :pocket-count="currentPocket.items.length"
      :boxes="catalog?.boxes ?? []"
      :search-index="catalog?.searchIndex ?? []"
      :can-go-back="canGoBack"
      @update:sort-base="settings = { ...settings, sortBase: $event }"
      @toggle-reversed="settings = { ...settings, reversed: !settings.reversed }"
      @update:theme="changeTheme"
      @update:avatar-size="settings = { ...settings, avatarSize: $event }"
      @open-box-filter="filterOpen = true"
      @open-pocket="drawerOpen = true"
      @copy-current="copyCurrentLink"
      @go-back="goBackFilter"
      @jump="handleJump"
    />

    <div v-if="catalog" class="catalog-status" aria-live="polite">
      <span><Database :size="15" aria-hidden="true" />{{ listView === 'operators' ? `${visibleOperators.length} 名干员` : `${visibleBoxes.length} 盒` }} · {{ visibleCharacters }} 条记录</span>
      <span>v2 · {{ catalog.generatedAt.slice(0, 10) }}</span>
    </div>
    <p v-if="notice" class="notice" role="status">{{ notice }} <button type="button" class="notice-close" aria-label="关闭提示" @click="notice = ''"><X :size="14" aria-hidden="true" /></button></p>
    <Transition name="toast">
      <div v-if="toast" class="toast-bubble" role="status">{{ toast }}</div>
    </Transition>

    <main v-if="catalog" class="workspace-layout">
      <div id="catalog" class="catalog-list">
        <template v-if="listView === 'boxes'">
          <CatalogBoxRow
            v-for="box in visibleBoxes"
            :key="box.id"
            :box="box"
            :show-prices="showPrices"
            :active-items="activeItems"
            :pocket-name="currentPocket.name"
            :mode="mode"
            :avatar-size="settings.avatarSize"
            @toggle="toggleItem"
            @copied="showToast"
          />
        </template>
        <OperatorView
          v-else
          :operators="visibleOperators"
          :show-prices="showPrices"
          :active-items="activeItems"
          :pocket-name="currentPocket.name"
          :mode="mode"
          :avatar-size="settings.avatarSize"
          @toggle="toggleItem"
        />
        <div v-if="(listView === 'boxes' ? !visibleBoxes.length : !visibleOperators.length)" class="empty-results">
          <AlertTriangle :size="28" aria-hidden="true" /><h2>没有符合条件的记录</h2>
          <p class="empty-hint">试试调整盒筛选，或用「跳转」直达某个盒；也可以复制当前链接分享给他人。</p>
          <div class="empty-actions">
            <button type="button" @click="query = ''; type = 'all'; selection = defaultBoxSelection()">清除当前查询</button>
            <button type="button" @click="copyCurrentLink"><Copy :size="15" aria-hidden="true" />复制当前链接</button>
          </div>
        </div>
      </div>
      <PocketPanel v-model:state="pockets" :index="variantIndex" :source-hash="catalog.sourceHash" />
    </main>

    <div v-else-if="loadError" class="load-state error-state" role="alert"><AlertTriangle :size="28" aria-hidden="true" /><h2>图鉴数据加载失败</h2><p>{{ loadError }}</p><button type="button" @click="reloadPage">重新加载</button></div>
    <div v-else class="load-state" aria-live="polite"><LoaderCircle class="spin" :size="28" aria-hidden="true" /><p>正在载入图鉴</p></div>

    <footer v-if="catalog" class="site-footer"><span>社区资料索引 · 非商业用途</span><a :href="catalog.sources.repository" target="_blank" rel="noreferrer">数据源</a><a href="https://github.com/KJH-x/Ak-Data" target="_blank" rel="noreferrer">Ak-Data 拼音数据</a><a href="https://prts.wiki" target="_blank" rel="noreferrer">PRTS</a><span>{{ catalog.sources.license }}</span></footer>

    <BoxFilterPanel :open="filterOpen" :boxes="catalog?.boxes ?? []" :selection="selection" @close="filterOpen = false" @apply="updateSelection" @copy-current="copyCurrentLink" />
    <div v-if="drawerOpen" class="drawer-backdrop" @mousedown.self="drawerOpen = false"><PocketPanel v-model:state="pockets" drawer :index="variantIndex" :source-hash="catalog?.sourceHash ?? ''" @close="drawerOpen = false" /><button type="button" class="sr-only" @click="drawerOpen = false">关闭口袋</button></div>
  </div>
</template>
