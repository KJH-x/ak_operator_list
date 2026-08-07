<script setup lang="ts">
import {
  Download,
  Clipboard,
  FileUp,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { IndexedVariant } from '@/lib/catalog'
import { formatPrice, parseVariantKey, priceBand, stateLabel } from '@/lib/catalog'
import {
  addPocket,
  clearPocket,
  deletePocket,
  exportPocketState,
  importPocketState,
  renamePocket,
  togglePocketItem,
} from '@/lib/pockets'
import { createShareUrl } from '@/lib/share'
import type { PocketState } from '@/types'
import LazyImage from './LazyImage.vue'

const props = defineProps<{
  state: PocketState
  index: Map<string, IndexedVariant>
  drawer?: boolean
  sourceHash: string
}>()

const emit = defineEmits<{
  'update:state': [state: PocketState]
  close: []
}>()

const creating = ref(false)
const editing = ref(false)
const name = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')

const currentPocket = computed(() => (
  props.state.pockets.find((pocket) => pocket.id === props.state.currentPocketId) ?? props.state.pockets[0]!
))

const resolvedItems = computed(() => currentPocket.value.items.map((key) => ({
  key,
  value: props.index.get(key) ?? null,
  identity: parseVariantKey(key),
})))

function update(state: PocketState) {
  emit('update:state', state)
}

function selectPocket(event: Event) {
  update({ ...props.state, currentPocketId: (event.target as HTMLSelectElement).value })
}

function beginCreate() {
  creating.value = true
  editing.value = false
  name.value = ''
}

function create() {
  update(addPocket(props.state, name.value))
  creating.value = false
}

function beginRename() {
  editing.value = true
  creating.value = false
  name.value = currentPocket.value.name
}

function rename() {
  update(renamePocket(props.state, currentPocket.value.id, name.value))
  editing.value = false
}

function removePocket() {
  if (window.confirm(`删除口袋“${currentPocket.value.name}”？`)) {
    update(deletePocket(props.state, currentPocket.value.id))
  }
}

function emptyPocket() {
  if (currentPocket.value.items.length && window.confirm(`清空口袋“${currentPocket.value.name}”？`)) {
    update(clearPocket(props.state, currentPocket.value.id))
  }
}

function downloadJson() {
  const blob = new Blob([exportPocketState(props.state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ak-pass-pockets.json'
  anchor.click()
  URL.revokeObjectURL(url)
  message.value = '口袋已导出'
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    update(importPocketState(await file.text()))
    message.value = '口袋已导入'
  } catch {
    message.value = '导入失败：文件格式无效'
  } finally {
    input.value = ''
  }
}

async function copyShareLink() {
  const url = createShareUrl(window.location, currentPocket.value, props.sourceHash)
  try {
    await navigator.clipboard.writeText(url)
    message.value = '分享链接已复制'
  } catch {
    const input = document.createElement('textarea')
    input.value = url
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    message.value = copied ? '分享链接已复制' : url
  }
}
</script>

<template>
  <aside class="pocket-panel" :class="{ drawer }" aria-label="口袋">
    <header class="pocket-header">
      <div>
        <WalletCards :size="20" aria-hidden="true" />
        <div>
          <span>LOCAL POCKET</span>
          <h2>我的口袋</h2>
        </div>
      </div>
      <button v-if="drawer" type="button" class="icon-button" aria-label="关闭口袋" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
    </header>

    <div class="pocket-selector">
      <label>
        <span class="sr-only">当前口袋</span>
        <select :value="currentPocket.id" @change="selectPocket">
          <option v-for="pocket in state.pockets" :key="pocket.id" :value="pocket.id">
            {{ pocket.name }} · {{ pocket.items.length }}
          </option>
        </select>
      </label>
      <button type="button" class="icon-button" title="新建口袋" aria-label="新建口袋" @click="beginCreate">
        <Plus :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="icon-button" title="重命名口袋" aria-label="重命名口袋" @click="beginRename">
        <Pencil :size="17" aria-hidden="true" />
      </button>
      <button type="button" class="icon-button danger" title="删除口袋" aria-label="删除口袋" @click="removePocket">
        <Trash2 :size="17" aria-hidden="true" />
      </button>
    </div>

    <form v-if="creating || editing" class="name-form" @submit.prevent="creating ? create() : rename()">
      <label>
        <span class="sr-only">口袋名称</span>
        <input v-model="name" maxlength="24" required :placeholder="creating ? '新口袋名称' : '口袋名称'" autofocus />
      </label>
      <button type="submit" class="primary-button">{{ creating ? '新建' : '保存' }}</button>
      <button type="button" class="icon-button" aria-label="取消" @click="creating = editing = false">
        <X :size="17" aria-hidden="true" />
      </button>
    </form>

    <div class="pocket-summary">
      <span>{{ currentPocket.items.length }} 款</span>
      <button type="button" :disabled="!currentPocket.items.length" @click="emptyPocket">清空</button>
    </div>

    <div v-if="resolvedItems.length" class="pocket-items">
      <article v-for="item in resolvedItems" :key="item.key" class="pocket-item">
        <template v-if="item.value">
          <LazyImage :image="item.value.character.image" :name="item.value.character.name" size="standard" />
          <div class="pocket-item-copy">
            <strong>{{ item.value.character.name }}</strong>
            <span>{{ item.value.box.id }} · {{ stateLabel(item.value.state) }}</span>
            <b :class="`price-${priceBand(item.value.variant.price)}`">
              {{ formatPrice(item.value.variant.price) }}
            </b>
          </div>
        </template>
        <template v-else>
          <span class="stale-image" aria-hidden="true">?</span>
          <div class="pocket-item-copy">
            <strong>数据已变更</strong>
            <span v-if="item.identity">
              {{ item.identity.boxId }} · {{ item.identity.characterName }} · {{ stateLabel(item.identity.state) }}
            </span>
            <span v-else>无法识别的旧收藏</span>
          </div>
        </template>
        <button
          type="button"
          class="icon-button remove-item"
          :aria-label="`从${currentPocket.name}移除${item.value?.character.name ?? '失效项目'}`"
          @click="update(togglePocketItem(state, currentPocket.id, item.key))"
        >
          <X :size="16" aria-hidden="true" />
        </button>
      </article>
    </div>
    <div v-else class="empty-pocket">
      <WalletCards :size="30" aria-hidden="true" />
      <p>口袋还是空的</p>
    </div>

    <footer class="pocket-actions">
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="导入口袋 JSON"
        @change="importJson"
      />
      <button type="button" @click="fileInput?.click()">
        <FileUp :size="16" aria-hidden="true" />导入
      </button>
      <button type="button" @click="downloadJson">
        <Download :size="16" aria-hidden="true" />导出
      </button>
      <button type="button" class="share-button" @click="copyShareLink">
        <Clipboard :size="16" aria-hidden="true" />复制分享链接
      </button>
      <span class="sr-only" aria-live="polite">{{ message }}</span>
      <output v-if="message && message.startsWith('http')" class="copy-fallback" aria-live="polite">{{ message }}</output>
    </footer>
  </aside>
</template>
