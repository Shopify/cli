import {type Store} from '../../api/graphql/business-platform-organizations/generated/types.js'
import {capitalizeWords} from '@shopify/cli-kit/common/string'

// The public store-type handle for every member of the BP `Store` enum, shared by `store info`
// (the `type` field) and `store list`. Declared as a fully-keyed record so adding a value to the
// enum fails type-checking here until it's given an explicit handle.
const STORE_TYPE_HANDLES: {[key in Store]: string} = {
  APP_DEVELOPMENT: 'dev',
  CLIENT_TRANSFER: 'client_transfer',
  COLLABORATOR: 'collaborator',
  DEVELOPMENT: 'dev',
  DEVELOPMENT_SUPERSET: 'dev',
  PRODUCTION: 'production',
}

// Returns undefined for an unrecognized value (e.g. a newer enum member than the generated types
// know about) so the field is omitted rather than shown as a guessed handle.
export function storeTypeHandle(storeType: string | null | undefined): string | undefined {
  if (!storeType) return undefined
  return STORE_TYPE_HANDLES[storeType as Store]
}

// Title-cased label for the `store list` table column (`dev` -> `Dev`, `client_transfer` ->
// `Client Transfer`).
export function storeTypeLabel(handle: string | undefined): string {
  return handle ? capitalizeWords(handle) : ''
}

// The BP `STORE_TYPE` filter value for every public handle `store list --type` accepts. `dev` maps
// to `development_superset`, BP's alias for "development OR app_development", so one query returns
// both the legacy partner dev store and the kind `store create dev` makes. `production` is an alias
// too, folding in the expansion/retail/internal/wholesale/buyer-facing variants. A handle maps to
// exactly one value because `STORE_TYPE` doesn't support the `In` operator.
const STORE_TYPE_FILTERS = {
  dev: 'development_superset',
  production: 'production',
  client_transfer: 'client_transfer',
  collaborator: 'collaborator',
} as const

export type StoreTypeFilter = keyof typeof STORE_TYPE_FILTERS

// The accepted `--type` values, in the order they appear in help output.
export const storeTypeFilters = Object.keys(STORE_TYPE_FILTERS) as StoreTypeFilter[]

export function storeTypeFilterValue(filter: StoreTypeFilter): string {
  return STORE_TYPE_FILTERS[filter]
}
