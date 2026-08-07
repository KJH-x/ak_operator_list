<script setup lang="ts">
import { CalendarDays, Layers3, Ticket } from 'lucide-vue-next'

import type { AvatarSize, CatalogBox } from '@/types'
import OperatorCard from './OperatorCard.vue'

defineProps<{
  box: CatalogBox
  showPrices: boolean
  activeItems: Set<string>
  pocketName: string
  mode: 'collect' | 'browse'
  avatarSize: AvatarSize
}>()

const emit = defineEmits<{
  toggle: [key: string]
}>()

const typeLabels: Record<string, string> = {
  numeric: '数字盒',
  ambience: '音律系列',
  cooperation: '联动系列',
  special: '特别款',
  whitelist: '白名单凭证',
}
</script>

<template>
  <section class="box-row" :aria-labelledby="`box-${box.id}`">
    <header class="box-meta">
      <div class="box-id-line">
        <span class="box-index">BOX</span>
        <h2 :id="`box-${box.id}`">{{ box.id }}</h2>
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
