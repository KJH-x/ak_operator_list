<script setup lang="ts">
import { CalendarDays, Check, Layers3, Link2, Ticket, Users } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

import { boxToToken, buildSingleBoxRoute } from '@/lib/boxRoutes'
import { copyText } from '@/lib/clipboard'
import type { AvatarSize, CatalogBox } from '@/types'
import OperatorCard from './OperatorCard.vue'

const props = defineProps<{
  box: CatalogBox
  showPrices: boolean
  activeItems: Set<string>
  pocketName: string
  mode: 'collect' | 'browse'
  avatarSize: AvatarSize
}>()

const emit = defineEmits<{
  toggle: [key: string]
  copied: [message: string]
}>()

const copiedId = ref<string | null>(null)
let copiedTimer: number | undefined

const typeLabels: Record<string, string> = {
  numeric: '数字盒',
  ambience: '音律系列',
  cooperation: '联动系列',
  special: '特别款',
  whitelist: '白名单凭证',
}

function boxRouteUrl(): string {
  // 规范形态：根路径 + hash（与 README「反向同步只写 hash」一致，App.vue:172-177）
  return `${window.location.origin}${buildSingleBoxRoute(props.box)}`
}

async function copyBoxLink() {
  const url = boxRouteUrl()
  const ok = await copyText(url)
  const token = boxToToken(props.box)
  if (ok) {
    copiedId.value = props.box.id
    if (copiedTimer) window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => { copiedId.value = null }, 1200)
    emit('copied', `已复制 #${token}`)
  } else {
    // 剪贴板彻底不可用时把 URL 放进 toast，便于手动复制
    emit('copied', `复制失败：${url}`)
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) window.clearTimeout(copiedTimer)
})
</script>

<template>
  <section class="box-row" :aria-labelledby="`box-${box.id}`">
    <header class="box-meta">
      <div class="box-id-line">
        <span class="box-index">BOX</span>
        <h2 :id="`box-${box.id}`">{{ box.id }}</h2>
        <button
          type="button"
          class="icon-button box-copy-link"
          :class="{ copied: copiedId === box.id }"
          :aria-label="`复制 ${box.id} 盒链接`"
          :title="`复制 ${box.id} 盒链接`"
          @click="copyBoxLink"
        >
          <Link2 v-if="copiedId !== box.id" :size="14" aria-hidden="true" />
          <Check v-else :size="14" aria-hidden="true" />
        </button>
      </div>
      <span class="type-label">{{ typeLabels[box.type] ?? box.type }}</span>
      <dl>
        <div>
          <dt><CalendarDays :size="14" aria-hidden="true" /><span class="sr-only">发行日期</span></dt>
          <dd>{{ box.releaseDate ?? '日期未录入' }}</dd>
        </div>
        <div>
          <dt><Layers3 :size="14" aria-hidden="true" /><span class="sr-only">记录数量</span></dt>
          <dd>{{ box.characterCount }} 人 / {{ box.variantCount }} 款</dd>
        </div>
        <div>
          <dt><Users :size="14" aria-hidden="true" /><span class="sr-only">盒内角色</span></dt>
          <dd class="box-characters">
            {{ box.characters.map((c) => c.name).slice(0, 8).join('、') }}
            {{ box.characters.length > 8 ? `等 ${box.characterCount} 人` : '' }}
          </dd>
        </div>
        <div>
          <dt><Ticket :size="14" aria-hidden="true" /><span class="sr-only">官方抽取价</span></dt>
          <dd>官方 {{ box.retailPrice ?? '价格未录入' }}</dd>
        </div>
      </dl>
    </header>
    <div class="operator-grid">
      <OperatorCard
        v-for="character in box.characters"
        :key="`${box.id}-${character.slot}-${character.name}`"
        :box="box"
        :character="character"
        :show-prices="showPrices"
        :active-items="activeItems"
        :pocket-name="pocketName"
        :mode="mode"
        :avatar-size="avatarSize"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </section>
</template>
