<script setup lang="ts">
import { CalendarDays, Layers3 } from 'lucide-vue-next'

import type { AvatarSize } from '@/types'
import type { OperatorAggregate } from '@/lib/catalog'
import OperatorCard from './OperatorCard.vue'

defineProps<{
  operators: OperatorAggregate[]
  showPrices: boolean
  activeItems: Set<string>
  pocketName: string
  mode: 'collect' | 'browse'
  avatarSize: AvatarSize
}>()

const emit = defineEmits<{ toggle: [key: string] }>()
</script>

<template>
  <div class="operator-view-list">
    <article v-for="operator in operators" :key="operator.operatorId" class="operator-view-card">
      <header class="operator-view-header">
        <div>
          <span class="operator-id">OPERATOR</span>
          <h2>{{ operator.name }}</h2>
          <p v-if="operator.latinName">{{ operator.latinName }}</p>
        </div>
        <dl>
          <div><dt><CalendarDays :size="13" aria-hidden="true" /></dt><dd>{{ operator.operatorReleaseDate ?? '日期未录入' }}</dd></div>
          <div><dt><Layers3 :size="13" aria-hidden="true" /></dt><dd>{{ operator.appearances.length }} 盒</dd></div>
        </dl>
      </header>
      <div class="operator-appearances">
        <div v-for="appearance in operator.appearances" :key="`${appearance.box.id}-${appearance.character.slot}`" class="operator-appearance">
          <span class="appearance-box">{{ appearance.box.id }}</span>
          <OperatorCard
            :box="appearance.box"
            :character="appearance.character"
            :show-prices="showPrices"
            :active-items="activeItems"
            :pocket-name="pocketName"
            :mode="mode"
            :avatar-size="avatarSize"
            @toggle="emit('toggle', $event)"
          />
        </div>
      </div>
    </article>
  </div>
</template>

