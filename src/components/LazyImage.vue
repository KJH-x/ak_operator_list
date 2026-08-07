<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { AssetRef, AvatarSize } from '@/types'

const props = defineProps<{
  image: AssetRef | null
  name: string
  size: AvatarSize
}>()

const root = ref<HTMLElement | null>(null)
const currentSrc = ref<string | null>(null)
const phase = ref<'idle' | 'tiny' | 'target' | 'tiny-fallback' | 'missing'>('idle')
let observer: IntersectionObserver | null = null
let visible = false

function targetUrl(): string | null {
  if (!props.image) return null
  return props.size === 'compact' ? (props.image.compactUrl ?? props.image.displayUrl) : props.image.displayUrl
}

function beginLoading() {
  if (!props.image) {
    phase.value = 'missing'
    currentSrc.value = null
    return
  }
  phase.value = 'tiny'
  currentSrc.value = props.image.tinyUrl
}

function onLoad() {
  if (phase.value === 'tiny') {
    phase.value = 'target'
    currentSrc.value = targetUrl()
  }
}

function onError() {
  if (!props.image) {
    phase.value = 'missing'
    currentSrc.value = null
  } else if (phase.value === 'tiny') {
    phase.value = 'target'
    currentSrc.value = targetUrl()
  } else if (phase.value === 'target' && props.image.tinyUrl) {
    phase.value = 'tiny-fallback'
    currentSrc.value = props.image.tinyUrl
  } else {
    phase.value = 'missing'
    currentSrc.value = null
  }
}

watch(() => [props.image?.hash, props.size], () => {
  phase.value = 'idle'
  currentSrc.value = null
  if (visible) beginLoading()
})

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    visible = true
    beginLoading()
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visible = true
      beginLoading()
      observer?.disconnect()
    }
  }, { rootMargin: '240px' })
  if (root.value) observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <span ref="root" class="lazy-image" :class="[`is-${phase}`, `size-${size}`]">
    <img
      v-if="currentSrc"
      :src="currentSrc"
      :alt="name"
      loading="lazy"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="image-placeholder" aria-hidden="true">
      <ImageOff :size="24" />
    </span>
  </span>
</template>
