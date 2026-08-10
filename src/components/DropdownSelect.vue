<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface DropdownOption {
  value: string
  label: string
}

const props = defineProps<{
  options: DropdownOption[]
  modelValue: string
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const highlight = ref(0)

const current = computed(() => props.options.find((option) => option.value === props.modelValue) ?? null)

function toggle() {
  open.value = !open.value
  if (open.value) highlight.value = Math.max(0, props.options.findIndex((option) => option.value === props.modelValue))
}

function select(option: DropdownOption) {
  emit('update:modelValue', option.value)
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!open.value) { open.value = true; return }
    highlight.value = (highlight.value + 1) % props.options.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) { open.value = true; return }
    highlight.value = (highlight.value - 1 + props.options.length) % props.options.length
  } else if ((event.key === 'Enter' || event.key === ' ') && open.value) {
    event.preventDefault()
    const option = props.options[highlight.value]
    if (option) select(option)
  }
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="root" class="select-control" :class="{ open }">
    <button
      type="button"
      class="select-trigger"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="select-trigger-label">{{ current?.label ?? '请选择' }}</span>
      <ChevronDown :size="15" class="select-chevron" aria-hidden="true" />
    </button>
    <transition name="drop">
      <div v-if="open" class="select-menu" role="listbox">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          :class="{ selected: option.value === modelValue, highlighted: index === highlight }"
          @click="select(option)"
          @mouseenter="highlight = index"
        >{{ option.label }}</button>
      </div>
    </transition>
  </div>
</template>
