export type VariantState = 'ELITE1' | 'ELITE2'

export type AvatarSize = 'standard' | 'compact'
export type ThemePreference = 'system' | 'light' | 'dark'
export type SortBase = 'category-time' | 'time' | 'operator-time'

export interface AssetRef {
  hash: string
  tinyUrl: string
  compactUrl: string | null
  displayUrl: string
  originalUrl: string
  sourceUrl: string
}

export interface CatalogVariant {
  state: VariantState
  price: number | null
}

export interface CatalogCharacter {
  slot: number
  name: string
  operatorId: string
  latinName: string | null
  searchAliases: string[]
  operatorReleaseDate: string | null
  prtsPageUrl: string | null
  image: AssetRef | null
  sourceImageUrl: string | null
  variants: CatalogVariant[]
}

export interface CatalogBox {
  id: string
  group: 'numeric' | 'special'
  type: string
  releaseDate: string | null
  replicateDates: string[]
  retailPrice: string | null
  characterCount: number
  variantCount: number
  characters: CatalogCharacter[]
}

export interface SearchIndexEntry {
  operatorId: string
  boxId: string
  slot: number
  name: string
  tokens: string[]
}

export interface CatalogSnapshot {
  version: 2
  sourceHash: string
  generatedAt: string
  stats: {
    boxes: number
    numericBoxes: number
    specialBoxes: number
    characterMemberships: number
    stateVariants: number
    uniqueSourceImages: number
    missingImages: number
    operators: number
  }
  sources: {
    catalog: string
    repository: string
    license: string
    akData?: string
    prts?: string
  }
  searchIndex: SearchIndexEntry[]
  boxes: CatalogBox[]
}

export interface Pocket {
  id: string
  name: string
  items: string[]
}

export interface PocketState {
  version: 1
  currentPocketId: string
  pockets: Pocket[]
}

export interface VariantIdentity {
  boxId: string
  characterName: string
  state: VariantState
}

export interface AppSettings {
  version: 1
  sortBase: SortBase
  reversed: boolean
  avatarSize: AvatarSize
  theme: ThemePreference
}

export interface SharedPocketPayload {
  version: 1
  pocketName: string
  items: string[]
  sourceHash: string
}
