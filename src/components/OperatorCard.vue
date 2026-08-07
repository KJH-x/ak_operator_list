<script setup lang="ts">
import { BookmarkCheck, BookmarkPlus, ExternalLink, Link as LinkIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import elite1Url from '@/assets/elite1.webp'
import elite2Url from '@/assets/elite2.webp'
import { formatPrice, priceBand, stateLabel, variantFor, variantKey } from '@/lib/catalog'
import type { AvatarSize, CatalogBox, CatalogCharacter, VariantState } from '@/types'
import LazyImage from './LazyImage.vue'

const props = withDefaults(defineProps<{
  box: CatalogBox
  character: CatalogCharacter
  showPrices: boolean
  activeItems: Set<string>
  pocketName: string
  mode: 'collect' | 'browse'
  avatarSize: AvatarSize
}>(), { mode: 'collect', avatarSize: 'standard' })

const emit = defineEmits<{ toggle: [key: string] }>()
const states: VariantState[] = ['ELITE1', 'ELITE2']
const image = computed(() => props.character.image)
const failedIcons = ref<Record<string, boolean>>({})
const eliteIcons: Record<VariantState, string> = {
  ELITE1: elite1Url,
  ELITE2: elite2Url,
}
const eliteIconSize: Record<VariantState, { width: number; height: number }> = {
  ELITE1: { width: 24, height: 16 },
  ELITE2: { width: 24, height: 20 },
}

function keyFor(state: VariantState): string {
  return variantKey({ boxId: props.box.id, characterName: props.character.name, state })
}

function active(state: VariantState): boolean {
  return props.activeItems.has(keyFor(state))
}

function toggle(state: VariantState) {
  if (variantFor(props.character, state)) emit('toggle', keyFor(state))
}

function markIconFailed(state: VariantState) {
  failedIcons.value = { ...failedIcons.value, [state]: true }
}
</script>

<template>
  <article class="operator-card" :aria-label="`${character.name}，${box.id} 盒`">
    <div class="portrait-wrap" :class="{ 'browse-portrait': mode === 'browse' }">
      <a
        v-if="mode === 'browse' && character.prtsPageUrl"
        class="portrait-link"
        :href="character.prtsPageUrl"
        target="_blank"
        rel="noreferrer"
        :aria-label="`打开 ${character.name} 的 PRTS 页面`"
      >
        <LazyImage :image="image" :name="character.name" :size="avatarSize" />
        <ExternalLink class="source-icon" :size="13" aria-hidden="true" />
      </a>
      <span
        v-else-if="mode === 'browse'"
        class="portrait-link portrait-disabled"
        role="img"
        :aria-label="`${character.name}：暂无资料`"
        :title="`${character.name}：暂无资料`"
      >
        <LazyImage :image="image" :name="character.name" :size="avatarSize" />
        <span class="missing-link-label">暂无资料</span>
      </span>
      <LazyImage v-else :image="image" :name="character.name" :size="avatarSize" />

      <template v-if="mode === 'collect'">
        <button
          v-for="state in states"
          :key="state"
          type="button"
          class="favorite-zone"
          :class="[`zone-${state.toLowerCase()}`, { active: active(state) }]"
          :disabled="!variantFor(character, state)"
          :aria-pressed="active(state)"
          :aria-label="variantFor(character, state)
            ? `${active(state) ? '从' : '加入'}${pocketName}：${character.name} ${stateLabel(state)}`
            : `${character.name} ${stateLabel(state)} 无此款`"
          @click="toggle(state)"
        >
          <template v-if="avatarSize === 'compact'">
            <img
              v-if="!failedIcons[state]"
              class="elite-icon"
              :src="eliteIcons[state]"
              :width="eliteIconSize[state].width"
              :height="eliteIconSize[state].height"
              :alt="`${character.name} ${stateLabel(state)}`"
              @error="markIconFailed(state)"
            />
            <span v-else class="elite-number">{{ state === 'ELITE1' ? '1' : '2' }}</span>
          </template>
          <template v-else>
            <BookmarkCheck v-if="active(state)" :size="18" aria-hidden="true" />
            <BookmarkPlus v-else :size="18" aria-hidden="true" />
            <span>{{ stateLabel(state) }}</span>
          </template>
        </button>
      </template>
      <LinkIcon v-if="mode === 'browse' && !character.prtsPageUrl" class="source-icon no-link" :size="14" aria-hidden="true" />
    </div>
    <h3 :title="character.latinName ? `${character.name} · ${character.latinName}` : character.name">{{ character.name }}</h3>
    <p v-if="character.latinName" class="latin-name">{{ character.latinName }}</p>
    <div v-show="showPrices" class="price-panel" aria-label="社区参考市价">
      <div v-for="state in states" :key="state" class="price-row">
        <span>{{ stateLabel(state) }}</span>
        <strong
          v-if="variantFor(character, state)"
          :class="`price-${priceBand(variantFor(character, state)!.price)}`"
        >{{ formatPrice(variantFor(character, state)!.price) }}</strong>
        <strong v-else class="price-unavailable">无此款</strong>
      </div>
    </div>
  </article>
</template>
