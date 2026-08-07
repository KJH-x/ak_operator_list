import { createApp } from 'vue'

import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')
document.documentElement.dataset.build = '20260807-v2'
requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'))
