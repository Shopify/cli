import {type RenderAutocompleteOptions} from '@shopify/cli-kit/node/ui'

/** The identity and labelling data a store picker needs, whatever shape the caller's store has. */
export interface StoreChoice {
  // Stable identifier for the store, used as the value the prompt submits.
  id: string
  // The store's myshopify.com domain.
  domain: string
  // Human-readable store name, when the caller knows one.
  name?: string
}

interface PromptChoice {
  label: string
  value: string
}

interface StoreChoiceListOptions<T> {
  stores: T[]
  // Projects a store onto the data the picker needs, so callers keep their own store shape.
  toChoice: (store: T) => StoreChoice
  // Whether labels name the domain alongside the store name. Defaults to true.
  showDomain?: boolean
  // Searches the caller's source by name, replacing the offered stores with the results.
  onSearch?: (term: string) => Promise<{stores: T[]; hasMorePages: boolean}>
  // Choices offered below the stores, such as creating one. Kept through searches.
  extraChoices?: PromptChoice[]
}

interface StoreChoiceList<T> {
  // Spread into `renderAutocompletePrompt`. `search` is absent, rather than set to undefined, when
  // the caller can't search remotely: an explicit `search: undefined` overrides the prompt's own
  // in-memory filtering instead of leaving it in place.
  promptProps: {choices: PromptChoice[]; search?: RenderAutocompleteOptions<string>['search']}
  // The store a submitted value stands for, or undefined for one of the extra choices.
  storeFor: (value: string) => T | undefined
}

/**
 * Labels a set of stores for an autocomplete prompt and resolves what the developer submits back to
 * the store it stands for, including stores that only a remote search brought in.
 *
 * Only this bookkeeping is shared. The wording, the surrounding flow, and any extra choices stay
 * with the caller, so `app dev` and the `store` commands can share it without sharing their flows.
 */
export function storeChoiceList<T>(options: StoreChoiceListOptions<T>): StoreChoiceList<T> {
  const {stores, toChoice, showDomain = true, extraChoices = [], onSearch} = options

  // Filled in as choices are built, so whatever a search offered stays resolvable afterwards.
  const storesByValue = new Map<string, T>()
  const choicesFor = (offered: T[]): PromptChoice[] => {
    const storeChoices = offered.map((store) => {
      const choice = toChoice(store)
      storesByValue.set(choice.id, store)

      return toPromptChoice(choice, showDomain)
    })

    return [...storeChoices, ...extraChoices]
  }

  const promptProps: StoreChoiceList<T>['promptProps'] = {choices: choicesFor(stores)}
  if (onSearch) {
    promptProps.search = async (term) => {
      const {stores: found, hasMorePages} = await onSearch(term)

      return {data: choicesFor(found), meta: {hasNextPage: hasMorePages}}
    }
  }

  return {promptProps, storeFor: (value) => storesByValue.get(value)}
}

// Names a store by name and domain together, falling back to whichever of the two the caller knows.
function toPromptChoice({id, domain, name}: StoreChoice, showDomain: boolean): PromptChoice {
  const label = showDomain && name && domain ? `${name} (${domain})` : (name ?? domain)

  return {label, value: id}
}
