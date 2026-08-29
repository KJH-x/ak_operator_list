(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const urlTheme = params.get('theme')
    const urlValid = urlTheme === 'dark' || urlTheme === 'light' || urlTheme === 'system'
    // 入站 ?theme= 优先（不写 localStorage，App 侧 urlThemeOverride 保持一致）；其次 localStorage
    const preference = urlValid
      ? urlTheme
      : (() => {
        const raw = localStorage.getItem('ak-pass:settings:v1')
        const value = raw ? JSON.parse(raw) : null
        return value && (value.theme === 'dark' || value.theme === 'light' || value.theme === 'system')
          ? value.theme
          : 'system'
      })()
    const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.themePreference = preference
  } catch (_) {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.dataset.themePreference = 'system'
  }
})()
