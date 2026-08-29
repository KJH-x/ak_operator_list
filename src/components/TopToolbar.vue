<script setup lang="ts">
import {
  ArrowDownUp,
  ChevronDown,
  Copy,
  ListFilter,
  LocateFixed,
  Monitor,
  Moon,
  PackageOpen,
  Search,
  Sun,
  Undo2,
  UsersRound,
  WalletCards,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { AvatarSize, CatalogBox, SearchIndexEntry } from '@/types'
import BoxJumpPanel from './BoxJumpPanel.vue'
import DropdownSelect from './DropdownSelect.vue'

const props = defineProps<{
  query: string
  type: string
  types: Array<{ value: string; label: string; count: number }>
  showPrices: boolean
  mode: 'collect' | 'browse'
  listView: 'boxes' | 'operators'
  sortBase: 'category-time' | 'time' | 'operator-time'
  reversed: boolean
  boxSelectionLabel: string
  pocketCount: number
  theme: 'system' | 'light' | 'dark'
  avatarSize: AvatarSize
  boxes: CatalogBox[]
  searchIndex: SearchIndexEntry[]
  canGoBack: boolean
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:type': [value: string]
  'update:showPrices': [value: boolean]
  'update:mode': [value: 'collect' | 'browse']
  'update:listView': [value: 'boxes' | 'operators']
  'update:sortBase': [value: 'category-time' | 'time' | 'operator-time']
  'toggle-reversed': []
  'update:theme': [value: 'system' | 'light' | 'dark']
  'update:avatarSize': [value: AvatarSize]
  openBoxFilter: []
  openPocket: []
  copyCurrent: []
  goBack: []
  jump: [hash: string]
}>()

const controlsOpen = ref(true)
const chevronRotation = ref(180)
const jumpOpen = ref(false)

function toggleControls() {
  controlsOpen.value = !controlsOpen.value
  chevronRotation.value += 180
}

const seriesOptions = computed(() => props.types.map((item) => ({ value: item.value, label: `${item.label} · ${item.count}` })))
const sortOptions = computed(() => props.listView === 'operators'
  ? [{ value: 'operator-time', label: '入游时间' }]
  : [{ value: 'category-time', label: '类别 · 时间' }, { value: 'time', label: '发行时间' }])
</script>

<template>
  <header class="topbar">
    <div class="topbar-row topbar-main">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">A</div>
        <div><h1>明日方舟通行认证</h1><span>LOCAL PASS CATALOG</span></div>
      </div>
      <div class="topbar-actions">
        <button
          type="button"
          class="icon-button toolbar-icon"
          :disabled="!canGoBack"
          :aria-label="canGoBack ? '返回上一筛选' : '暂无上一筛选'"
          :title="canGoBack ? '返回上一筛选' : '暂无上一筛选'"
          @click="emit('goBack')"
        >
          <Undo2 :size="17" aria-hidden="true" />
        </button>
        <button type="button" class="icon-button toolbar-icon" aria-label="复制当前筛选链接" title="复制当前筛选链接" @click="emit('copyCurrent')">
          <Copy :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="icon-button collapse-toggle"
          :aria-label="controlsOpen ? '收起视图控件' : '展开视图控件'"
          :aria-expanded="controlsOpen"
          @click="toggleControls"
        >
          <ChevronDown :size="18" class="collapse-chevron" :style="{ transform: `rotate(${chevronRotation}deg)` }" aria-hidden="true" />
        </button>
        <button type="button" class="toolbar-button mobile-pocket-button" :aria-label="`打开口袋，${pocketCount} 款`" @click="emit('openPocket')"><WalletCards :size="17" aria-hidden="true" /><span>口袋 {{ pocketCount }}</span></button>
      </div>
    </div>

    <div v-if="controlsOpen" class="topbar-row topbar-controls-row">
      <div class="toolbar-controls">
        <div class="toolbar-left-group">
          <label class="switch-control">
            <input type="checkbox" aria-label="显示社区参考价" :checked="showPrices" @change="emit('update:showPrices', ($event.target as HTMLInputElement).checked)" />
            <span class="switch-track" aria-hidden="true"><span /></span><span>参考价</span>
          </label>
          <label class="search-control">
            <Search :size="17" aria-hidden="true" />
            <span class="sr-only">搜索中文、拼音或英文</span>
            <input type="search" :value="query" placeholder="拼音 / 英文" @input="emit('update:query', ($event.target as HTMLInputElement).value)" />
          </label>
          <button
            type="button"
            class="toolbar-button"
            :class="{ active: jumpOpen }"
            aria-label="跳到盒"
            :aria-expanded="jumpOpen"
            @click="jumpOpen = !jumpOpen"
          >
            <LocateFixed :size="17" aria-hidden="true" /><span>跳转</span>
          </button>
          <DropdownSelect :model-value="type" :options="seriesOptions" label="系列筛选" @update:model-value="emit('update:type', $event)" />
          <DropdownSelect
            :model-value="sortBase"
            :options="sortOptions"
            label="排序方式"
            @update:model-value="emit('update:sortBase', $event as 'category-time' | 'time' | 'operator-time')"
          />
          <button type="button" class="toolbar-button" :aria-label="`盒款筛选：${boxSelectionLabel}`" @click="emit('openBoxFilter')">
            <ListFilter :size="17" aria-hidden="true" /><span>{{ boxSelectionLabel }}</span>
          </button>
          <button type="button" class="icon-button toolbar-icon" :class="{ active: reversed }" :aria-label="reversed ? '恢复正序' : '反向排序'" :aria-pressed="reversed" @click="emit('toggle-reversed')"><ArrowDownUp :size="17" aria-hidden="true" /></button>
        </div>
        <div class="toolbar-right-group">
          <div class="segmented mode-segment" aria-label="交互模式">
            <button type="button" :class="{ active: mode === 'collect' }" :aria-pressed="mode === 'collect'" @click="emit('update:mode', 'collect')">收藏</button>
            <button type="button" :class="{ active: mode === 'browse' }" :aria-pressed="mode === 'browse'" @click="emit('update:mode', 'browse')">浏览</button>
          </div>
          <div class="segmented view-segment" aria-label="内容视图">
            <button type="button" :class="{ active: listView === 'boxes' }" :aria-pressed="listView === 'boxes'" @click="emit('update:listView', 'boxes')"><PackageOpen :size="15" aria-hidden="true" /><span>按盒</span></button>
            <button type="button" :class="{ active: listView === 'operators' }" :aria-pressed="listView === 'operators'" @click="emit('update:listView', 'operators')"><UsersRound :size="15" aria-hidden="true" /><span>按干员</span></button>
          </div>
          <div class="segmented theme-segment" aria-label="主题">
            <button type="button" :class="{ active: theme === 'system' }" :aria-pressed="theme === 'system'" @click="emit('update:theme', 'system')"><Monitor :size="15" aria-hidden="true" /><span>跟随系统</span></button>
            <button type="button" :class="{ active: theme === 'light' }" :aria-pressed="theme === 'light'" @click="emit('update:theme', 'light')"><Sun :size="15" aria-hidden="true" /><span>日间</span></button>
            <button type="button" :class="{ active: theme === 'dark' }" :aria-pressed="theme === 'dark'" @click="emit('update:theme', 'dark')"><Moon :size="15" aria-hidden="true" /><span>夜间</span></button>
          </div>
          <div class="segmented avatar-segment" aria-label="头像尺寸">
            <button type="button" :class="{ active: avatarSize === 'standard' }" :aria-pressed="avatarSize === 'standard'" @click="emit('update:avatarSize', 'standard')"><span>标准</span></button>
            <button type="button" :class="{ active: avatarSize === 'compact' }" :aria-pressed="avatarSize === 'compact'" @click="emit('update:avatarSize', 'compact')"><span>紧凑</span></button>
          </div>
        </div>
      </div>
    </div>

    <BoxJumpPanel
      :open="jumpOpen"
      :boxes="boxes"
      :index="searchIndex"
      @close="jumpOpen = false"
      @jump="(hash: string) => { jumpOpen = false; emit('jump', hash) }"
    />
  </header>
</template>
