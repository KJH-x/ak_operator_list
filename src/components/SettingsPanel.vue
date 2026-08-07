<script setup lang="ts">
import { Check, Monitor, Moon, Sun, X } from 'lucide-vue-next'

import type { AppSettings, AvatarSize } from '@/types'

defineProps<{ open: boolean; settings: AppSettings }>()
const emit = defineEmits<{
  close: []
  'update:avatarSize': [value: AvatarSize]
  'update:theme': [value: AppSettings['theme']]
}>()
</script>

<template>
  <div v-if="open" class="dialog-backdrop settings-backdrop" @mousedown.self="emit('close')">
    <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header><div><span>LOCAL PREFERENCES</span><h2 id="settings-title">显示设置</h2></div><button type="button" class="icon-button" aria-label="关闭设置" @click="emit('close')"><X :size="19" aria-hidden="true" /></button></header>
      <div class="settings-body">
        <fieldset>
          <legend>头像尺寸</legend>
          <div class="settings-options">
            <button type="button" :class="{ selected: settings.avatarSize === 'standard' }" :aria-pressed="settings.avatarSize === 'standard'" @click="emit('update:avatarSize', 'standard')"><span class="size-preview standard-preview" aria-hidden="true" /><span>标准</span><Check v-if="settings.avatarSize === 'standard'" :size="15" aria-hidden="true" /></button>
            <button type="button" :class="{ selected: settings.avatarSize === 'compact' }" :aria-pressed="settings.avatarSize === 'compact'" @click="emit('update:avatarSize', 'compact')"><span class="size-preview compact-preview" aria-hidden="true" /><span>紧凑</span><Check v-if="settings.avatarSize === 'compact'" :size="15" aria-hidden="true" /></button>
          </div>
        </fieldset>
        <fieldset>
          <legend>主题</legend>
          <div class="settings-options theme-options">
            <button type="button" :class="{ selected: settings.theme === 'system' }" :aria-pressed="settings.theme === 'system'" @click="emit('update:theme', 'system')"><Monitor :size="17" aria-hidden="true" /><span>跟随系统</span></button>
            <button type="button" :class="{ selected: settings.theme === 'light' }" :aria-pressed="settings.theme === 'light'" @click="emit('update:theme', 'light')"><Sun :size="17" aria-hidden="true" /><span>日间</span></button>
            <button type="button" :class="{ selected: settings.theme === 'dark' }" :aria-pressed="settings.theme === 'dark'" @click="emit('update:theme', 'dark')"><Moon :size="17" aria-hidden="true" /><span>夜间</span></button>
          </div>
        </fieldset>
      </div>
      <footer><button type="button" class="primary-button" @click="emit('close')">完成</button></footer>
    </section>
  </div>
</template>

