<script setup lang="ts">
import { Check, RotateCcw, Search, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { applyBoxSelection, defaultBoxSelection, type BoxSelection } from '@/lib/filters'
import type { CatalogBox } from '@/types'

const props = defineProps<{
  open: boolean
  boxes: CatalogBox[]
  selection: BoxSelection
}>()

const emit = defineEmits<{
  close: []
  apply: [selection: BoxSelection]
}>()

const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const draft = ref(new Set<string>())

const typeLabels: Record<string, string> = {
  numeric: '数字盒',
  ambience: '音律',
  cooperation: '联动',
  special: '特别款',
  whitelist: '白名单',
}

const types = computed(() => [...new Set(props.boxes.map((box) => box.type))])
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!needle) return props.boxes
  return props.boxes.filter((box) => (
    box.id.toLocaleLowerCase('zh-CN').includes(needle)
      || box.characters.some((character) => character.name.toLocaleLowerCase('zh-CN').includes(needle))
  ))
})

watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  draft.value = new Set(props.selection.custom ? props.selection.selectedIds : props.boxes.map((box) => box.id))
  await nextTick()
  searchInput.value?.focus()
})

function toggleType(type: string) {
  const ids = props.boxes.filter((box) => box.type === type).map((box) => box.id)
  const allSelected = ids.every((id) => draft.value.has(id))
  const next = new Set(draft.value)
  for (const id of ids) allSelected ? next.delete(id) : next.add(id)
  draft.value = next
}

function toggle(id: string) {
  const next = new Set(draft.value)
  next.has(id) ? next.delete(id) : next.add(id)
  draft.value = next
}

function reset() {
  emit('apply', defaultBoxSelection())
}

function apply() {
  emit('apply', applyBoxSelection(draft.value))
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @mousedown.self="emit('close')" @keydown.esc="emit('close')">
    <section class="filter-dialog" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <header>
        <div>
          <span>BOX FILTER</span>
          <h2 id="filter-title">选择要显示的盒</h2>
        </div>
        <button type="button" class="icon-button" aria-label="关闭盒筛选" @click="emit('close')">
          <X :size="20" aria-hidden="true" />
        </button>
      </header>
      <div class="filter-tools">
        <label class="search-control">
          <Search :size="16" aria-hidden="true" />
          <span class="sr-only">搜索盒或角色</span>
          <input ref="searchInput" v-model="query" type="search" placeholder="盒号 / 角色" />
        </label>
        <div class="batch-actions">
          <button v-for="type in types" :key="type" type="button" @click="toggleType(type)">
            {{ typeLabels[type] ?? type }}
          </button>
        </div>
        <div class="selection-actions">
          <button type="button" @click="draft = new Set(boxes.map((box) => box.id))">全选</button>
          <button type="button" @click="draft = new Set()">清空</button>
        </div>
      </div>
      <div class="box-choice-grid">
        <label v-for="box in filtered" :key="box.id" :class="{ checked: draft.has(box.id) }">
          <input type="checkbox" :checked="draft.has(box.id)" @change="toggle(box.id)" />
          <span class="custom-check"><Check :size="13" aria-hidden="true" /></span>
          <span class="choice-copy">
            <strong>{{ box.id }}</strong>
            <small>{{ typeLabels[box.type] ?? box.type }} · {{ box.characterCount }} 人</small>
          </span>
        </label>
      </div>
      <footer>
        <span>已选 {{ draft.size }} / {{ boxes.length }}</span>
        <div>
          <button type="button" class="text-button" @click="reset">
            <RotateCcw :size="16" aria-hidden="true" />恢复默认
          </button>
          <button type="button" class="primary-button" @click="apply">应用筛选</button>
        </div>
      </footer>
    </section>
  </div>
</template>
