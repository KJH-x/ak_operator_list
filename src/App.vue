<script setup lang="ts">
import { AlertTriangle, Database, LoaderCircle, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import BoxFilterPanel from '@/components/BoxFilterPanel.vue'
import CatalogBoxRow from '@/components/CatalogBoxRow.vue'
import OperatorView from '@/components/OperatorView.vue'
import PocketPanel from '@/components/PocketPanel.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import TopToolbar from '@/components/TopToolbar.vue'
import { aggregateOperators, buildVariantIndex, filterOperatorAggregates, sortBoxes } from '@/lib/catalog'
import { defaultBoxSelection, filterBoxes, loadBoxSelection, saveBoxSelection, type BoxSelection } from '@/lib/filters'
import { applyTheme, loadSettings, saveSettings } from '@/lib/settings'
import { readShareHash } from '@/lib/share'
import { loadPocketState, mergeSharedPocket, savePocketState, togglePocketItem } from '@/lib/pockets'
import type { AppSettings, CatalogSnapshot, PocketState } from '@/types'

const catalog = ref<CatalogSnapshot | null>(null)
const loadError = ref('')
const query = ref('')
const type = ref('all')
const showPrices = ref(false)
const mode = ref<'collect' | 'browse'>('collect')
const listView = ref<'boxes' | 'operators'>('boxes')
const filterOpen = ref(false)
const settingsOpen = ref(false)
const drawerOpen = ref(false)
const selection = ref<BoxSelection>(defaultBoxSelection())
const settings = ref<AppSettings>(loadSettings(window.localStorage))
const pockets = ref<PocketState>(loadPocketState(window.localStorage))
const notice = ref('')

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
  applyTheme(document.documentElement, value.theme, prefersDark)
}, { deep: true })

onMounted(async () => {
  selection.value = loadBoxSelection(window.localStorage)
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  applyTheme(document.documentElement, settings.value.theme, prefersDark)
  try {
    const response = await fetch('/data/catalog.v2.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    catalog.value = await response.json() as CatalogSnapshot
    importSharedHash()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '未知错误'
  }
})

function importSharedHash() {
  if (!window.location.hash) return
  try {
    const payload = readShareHash(window.location.hash)
    if (payload) {
      pockets.value = mergeSharedPocket(pockets.value, payload)
      notice.value = `已合并口袋“${payload.pocketName}”${payload.sourceHash !== catalog.value?.sourceHash ? '（数据版本不同，失效项目已保留）' : ''}`
    }
  } catch {
    notice.value = '分享链接无效，未导入任何内容'
  } finally {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
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

function updateTheme(theme: AppSettings['theme']) { settings.value = { ...settings.value, theme } }
function updateAvatarSize(avatarSize: AppSettings['avatarSize']) { settings.value = { ...settings.value, avatarSize } }
function reloadPage() { window.location.reload() }
</script>

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
      :types="typeOptions"
      :box-selection-label="boxSelectionLabel"
      :pocket-count="currentPocket.items.length"
      @update:sort-base="settings = { ...settings, sortBase: $event }"
      @toggle-reversed="settings = { ...settings, reversed: !settings.reversed }"
      @open-box-filter="filterOpen = true"
      @open-pocket="drawerOpen = true"
      @open-settings="settingsOpen = true"
    />

    <div v-if="catalog" class="catalog-status" aria-live="polite">
      <span><Database :size="15" aria-hidden="true" />{{ listView === 'operators' ? `${visibleOperators.length} 名干员` : `${visibleBoxes.length} 盒` }} · {{ visibleCharacters }} 条记录</span>
      <span>v2 · {{ catalog.generatedAt.slice(0, 10) }}</span>
    </div>
    <p v-if="notice" class="notice" role="status">{{ notice }} <button type="button" class="notice-close" aria-label="关闭提示" @click="notice = ''"><X :size="14" aria-hidden="true" /></button></p>

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
          <button type="button" @click="query = ''; type = 'all'; selection = defaultBoxSelection()">清除当前查询</button>
        </div>
      </div>
      <PocketPanel v-model:state="pockets" :index="variantIndex" :source-hash="catalog.sourceHash" />
    </main>

    <div v-else-if="loadError" class="load-state error-state" role="alert"><AlertTriangle :size="28" aria-hidden="true" /><h2>图鉴数据加载失败</h2><p>{{ loadError }}</p><button type="button" @click="reloadPage">重新加载</button></div>
    <div v-else class="load-state" aria-live="polite"><LoaderCircle class="spin" :size="28" aria-hidden="true" /><p>正在载入图鉴</p></div>

    <footer v-if="catalog" class="site-footer"><span>社区资料索引 · 非商业用途</span><a :href="catalog.sources.repository" target="_blank" rel="noreferrer">数据源</a><a href="https://prts.wiki" target="_blank" rel="noreferrer">PRTS</a><span>{{ catalog.sources.license }}</span></footer>

    <BoxFilterPanel :open="filterOpen" :boxes="catalog?.boxes ?? []" :selection="selection" @close="filterOpen = false" @apply="updateSelection" />
    <SettingsPanel :open="settingsOpen" :settings="settings" @close="settingsOpen = false" @update:theme="updateTheme" @update:avatar-size="updateAvatarSize" />
    <div v-if="drawerOpen" class="drawer-backdrop" @mousedown.self="drawerOpen = false"><PocketPanel v-model:state="pockets" drawer :index="variantIndex" :source-hash="catalog?.sourceHash ?? ''" @close="drawerOpen = false" /><button type="button" class="sr-only" @click="drawerOpen = false">关闭口袋</button></div>
  </div>
</template>
