<script setup lang="ts">
import { ArrowDownUp, ListFilter, Moon, PackageOpen, Search, Settings2, Sun, Tag, UsersRound, WalletCards } from 'lucide-vue-next'
import { computed } from 'vue'

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
  openBoxFilter: []
  openPocket: []
  openSettings: []
}>()

const sortOptions = computed(() => props.listView === 'operators'
  ? [{ value: 'operator-time', label: '入游时间' }]
  : [{ value: 'category-time', label: '类别 · 时间' }, { value: 'time', label: '发行时间' }])
</script>

<template>
  <header class="topbar">
    <div class="brand-block">
      <div class="brand-mark" aria-hidden="true">A</div>
      <div><h1>明日方舟通行认证</h1><span>LOCAL PASS CATALOG</span></div>
    </div>
    <div class="toolbar-controls">
      <label class="search-control">
        <Search :size="17" aria-hidden="true" />
        <span class="sr-only">搜索中文、英文、拼音或首字母</span>
        <input type="search" :value="query" placeholder="角色 / 英文 / 拼音 / 首字母" @input="emit('update:query', ($event.target as HTMLInputElement).value)" />
      </label>
      <label class="select-control">
        <Tag :size="16" aria-hidden="true" /><span class="sr-only">系列筛选</span>
        <select :value="type" @change="emit('update:type', ($event.target as HTMLSelectElement).value)">
          <option v-for="item in types" :key="item.value" :value="item.value">{{ item.label }} · {{ item.count }}</option>
        </select>
      </label>
      <button type="button" class="toolbar-button" :aria-label="`盒款筛选：${boxSelectionLabel}`" @click="emit('openBoxFilter')">
        <ListFilter :size="17" aria-hidden="true" /><span>{{ boxSelectionLabel }}</span>
      </button>
      <label class="switch-control">
        <input type="checkbox" aria-label="显示社区参考价" :checked="showPrices" @change="emit('update:showPrices', ($event.target as HTMLInputElement).checked)" />
        <span class="switch-track" aria-hidden="true"><span /></span><span>参考价</span>
      </label>
      <div class="segmented mode-segment" aria-label="交互模式">
        <button type="button" :class="{ active: mode === 'collect' }" :aria-pressed="mode === 'collect'" @click="emit('update:mode', 'collect')">收藏</button>
        <button type="button" :class="{ active: mode === 'browse' }" :aria-pressed="mode === 'browse'" @click="emit('update:mode', 'browse')">浏览</button>
      </div>
      <div class="segmented view-segment" aria-label="内容视图">
        <button type="button" :class="{ active: listView === 'boxes' }" :aria-pressed="listView === 'boxes'" @click="emit('update:listView', 'boxes')"><PackageOpen :size="15" aria-hidden="true" /><span>按盒</span></button>
        <button type="button" :class="{ active: listView === 'operators' }" :aria-pressed="listView === 'operators'" @click="emit('update:listView', 'operators')"><UsersRound :size="15" aria-hidden="true" /><span>按干员</span></button>
      </div>
      <label class="sort-control">
        <span class="sr-only">排序方式</span>
        <select :value="sortBase" @change="emit('update:sortBase', ($event.target as HTMLSelectElement).value as 'category-time' | 'time' | 'operator-time')">
          <option v-for="item in sortOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
      <button type="button" class="icon-button toolbar-icon" :aria-label="reversed ? '恢复正序' : '反向排序'" :aria-pressed="reversed" @click="emit('toggle-reversed')"><ArrowDownUp :size="17" aria-hidden="true" /></button>
      <button type="button" class="icon-button toolbar-icon" aria-label="打开设置" @click="emit('openSettings')"><Settings2 :size="17" aria-hidden="true" /></button>
      <button type="button" class="toolbar-button mobile-pocket-button" :aria-label="`打开口袋，${pocketCount} 款`" @click="emit('openPocket')"><WalletCards :size="17" aria-hidden="true" /><span>口袋 {{ pocketCount }}</span></button>
    </div>
  </header>
</template>
