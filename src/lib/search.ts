import type { CatalogCharacter, CatalogBox } from '@/types'
import { initialsFor as baseInitialsFor, pinyinFor as basePinyinFor } from './pinyin'

/** Keep search behavior identical for CJK, Latin, spaces and punctuation. */
export function normalizeSearchText(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')
    : ''
}

export function pinyinFor(value: string): string {
  return normalizeSearchText(basePinyinFor(value))
}

export function initialsFor(value: string): string {
  return normalizeSearchText(baseInitialsFor(value))
}

export function characterSearchTokens(character: Pick<CatalogCharacter, 'name' | 'latinName' | 'searchAliases'>): string[] {
  const values = [
    character.name,
    character.latinName ?? '',
    ...character.searchAliases,
    pinyinFor(character.name),
    initialsFor(character.name),
  ]
  return [...new Set(values.map(normalizeSearchText).filter(Boolean))]
}

export function matchesSearch(value: string, query: string): boolean {
  const needle = normalizeSearchText(query)
  if (!needle) return true
  return normalizeSearchText(value).includes(needle)
}

export function characterMatches(character: CatalogCharacter, query: string): boolean {
  const needle = normalizeSearchText(query)
  if (!needle) return true
  return characterSearchTokens(character).some((token) => token.includes(needle))
}

export function boxMatches(box: CatalogBox, query: string): boolean {
  return matchesSearch(box.id, query)
}
