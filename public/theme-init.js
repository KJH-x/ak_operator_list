(() => {
  try {
    const raw = localStorage.getItem('ak-pass:settings:v1')
    const value = raw ? JSON.parse(raw) : null
    const preference = value && (value.theme === 'dark' || value.theme === 'light' || value.theme === 'system')
      ? value.theme
      : 'system'
    const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.themePreference = preference
  } catch (_) {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.dataset.themePreference = 'system'
  }
})()
