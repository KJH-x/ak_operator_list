<script setup lang="ts">
import { CornerDownLeft, Search, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { boxToToken } from '@/lib/boxRoutes'
import { normalizeSearchText } from '@/lib/search'
import type { CatalogBox, SearchIndexEntry } from '@/types'

const props = defineProps<{
  open: boolean
  boxes: CatalogBox[]
  index: SearchIndexEntry[]
}>()

const emit = defineEmits<{
  close: []
  jump: [hash: string]
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

interface BoxSuggestion { kind: 'box'; id: string; token: string; name: string }
interface OpSuggestion { kind: 'op'; name: string; boxId: string; slot: number; token: string }

type Suggestion = BoxSuggestion | OpSuggestion

const boxSuggestions = computed<BoxSuggestion[]>(() => {
  const needle = normalizeSearchText(query.value)
  const list = props.boxes
    .map((box) => ({ kind: 'box' as const, id: box.id, token: boxToToken(box), name: box.id }))
  if (!needle) return list.slice(0, 200)
  return list.filter((item) => normalizeSearchText(item.name).includes(needle))
})

const opSuggestions = computed<OpSuggestion[]>(() => {
  const needle = normalizeSearchText(query.value)
  if (!needle) return []
  const seen = new Set<string>()
  const out: OpSuggestion[] = []
  for (const entry of props.index) {
    const key = `${entry.boxId}|${entry.slot}|${entry.name}`
    if (seen.has(key)) continue
    seen.add(key)
    const haystack = [entry.name, entry.boxId, ...entry.tokens].map(normalizeSearchText).join(' ')
    if (haystack.includes(needle)) {
      const box = props.boxes.find((candidate) => candidate.id === entry.boxId)
      out.push({
        kind: 'op',
        name: entry.name,
        boxId: entry.boxId,
        slot: entry.slot,
        token: box ? boxToToken(box) : encodeURIComponent(entry.boxId),
      })
      if (out.length >= 12) break
    }
  }
  return out
})

const suggestions = computed<Suggestion[]>(() => [...boxSuggestions.value, ...opSuggestions.value])

watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  await nextTick()
  inputEl.value?.focus()
})

function jumpTo(suggestion: Suggestion) {
  if (suggestion.kind === 'box') {
    emit('jump', `#${suggestion.token}`)
  } else {
    emit('jump', `#${suggestion.token}&op=${suggestion.slot}`)
  }
  emit('close')
}

function onDocumentMouseDown(event: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'Enter' && suggestions.value.length) jumpTo(suggestions.value[0]!)
}

onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))
</script>

<template>
  <div ref="rootEl" v-if="open" class="jump-panel" role="dialog" aria-label="跳到盒">
    <div class="jump-search">
      <Search :size="16" aria-hidden="true" />
      <label class="sr-only" for="jump-input">输入盒号、盒名或角色名</label>
      <input
        id="jump-input"
        ref="inputEl"
        v-model="query"
        type="search"
        placeholder="盒号 / 盒名 / 角色名"
        @keydown="onKeydown"
      />
      <button type="button" class="icon-button jump-close" aria-label="关闭跳转" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <div class="jump-body">
      <template v-if="suggestions.length">
        <div class="jump-section-label">盒 / 角色建议（Enter 直达首个）</div>
        <ul class="jump-suggestions" role="listbox">
          <li v-for="suggestion in suggestions" :key="`${suggestion.kind}-${suggestion.kind === 'box' ? suggestion.id : `${suggestion.boxId}-${suggestion.slot}`}`">
            <button type="button" role="option" @click="jumpTo(suggestion)">
              <span class="jump-kind">{{ suggestion.kind === 'box' ? '盒' : '角色' }}</span>
              <span class="jump-name">{{ suggestion.kind === 'box' ? suggestion.id : suggestion.name }}</span>
              <span v-if="suggestion.kind === 'op'" class="jump-sub">{{ suggestion.boxId }}</span>
              <CornerDownLeft class="jump-go" :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>
      <p v-else class="jump-empty">没有匹配的盒或角色</p>
    </div>
  </div>
</template>
