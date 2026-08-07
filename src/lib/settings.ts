import type { AppSettings, AvatarSize, SortBase, ThemePreference } from '@/types'

export const SETTINGS_STORAGE_KEY = 'ak-pass:settings:v1'

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  sortBase: 'category-time',
  reversed: false,
  avatarSize: 'standard',
  theme: 'system',
}

function validSort(value: unknown): SortBase {
  return value === 'time' || value === 'operator-time' || value === 'category-time'
    ? value
    : DEFAULT_SETTINGS.sortBase
}

function validAvatar(value: unknown): AvatarSize {
  return value === 'compact' ? 'compact' : 'standard'
}

function validTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS }
  const candidate = value as Partial<AppSettings>
  return {
    version: 1,
    sortBase: validSort(candidate.sortBase),
    reversed: candidate.reversed === true,
    avatarSize: validAvatar(candidate.avatarSize),
    theme: validTheme(candidate.theme),
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'>): AppSettings {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? normalizeSettings(JSON.parse(raw) as unknown) : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: AppSettings): void {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)))
}

export function resolveTheme(theme: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

export function applyTheme(root: HTMLElement, theme: ThemePreference, prefersDark = false): void {
  root.dataset.theme = resolveTheme(theme, prefersDark)
  root.dataset.themePreference = theme
}

