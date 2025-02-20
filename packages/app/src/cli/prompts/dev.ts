/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Organization, MinimalOrganizationApp, OrganizationStore, MinimalAppIdentifiers} from '../models/organization.js'
import {getTomls} from '../utilities/app/config/getTomls.js'
import {setCachedCommandTomlMap} from '../services/local-storage.js'
import {Paginateable} from '../utilities/developer-platform-client.js'
import {APP_NAME_MAX_LENGTH} from '../models/app/validation/common.js'
import {
  RenderAutocompleteOptions,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {outputCompleted} from '@shopify/cli-kit/node/output'

export async function selectOrganizationPrompt(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 1) {
    return organizations[0]!
  }
  const orgList = organizations.map((org) => ({label: org.businessName, value: org.id}))
  const id = await renderAutocompletePrompt({
    message: `Which organization is this work for?`,
    choices: orgList,
  })
  return organizations.find((org) => org.id === id)!
}

export async function selectAppPrompt(
  onSearchForAppsByName: (term: string) => Promise<{apps: MinimalOrganizationApp[]; hasMorePages: boolean}>,
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  options?: {
    directory?: string
  },
): Promise<MinimalAppIdentifiers> {
  const tomls = await getTomls(options?.directory)

  if (tomls) setCachedCommandTomlMap(tomls)

  const toAnswer = (app: MinimalOrganizationApp) => {
    if (tomls[app?.apiKey]) {
      return {label: `${app.title} (${tomls[app.apiKey]})`, value: app.apiKey}
    }

    return {label: app.title, value: app.apiKey}
  }

  let currentAppChoices = apps

  const apiKey = await renderAutocompletePrompt({
    message: 'Which existing app is this for?',
    choices: currentAppChoices.map(toAnswer),
    hasMorePages,
    search: async (term) => {
      const result = await onSearchForAppsByName(term)
      currentAppChoices = result.apps

      return {
        data: currentAppChoices.map(toAnswer),
        meta: {
          hasNextPage: result.hasMorePages,
        },
      }
    },
  })
  return currentAppChoices.find((app) => app.apiKey === apiKey)!
}

interface SelectStorePromptOptions {
  onSearchForStoresByName?: (term: string) => Promise<Paginateable<{stores: OrganizationStore[]}>>
  stores: OrganizationStore[]
  hasMorePages?: boolean
  showDomainOnPrompt: boolean
}

interface ExtraAutoCompletePropsForStoreSelect {
  search?: RenderAutocompleteOptions<string>['search']
}

export async function selectStorePrompt({
  stores,
  hasMorePages = false,
  onSearchForStoresByName,
  showDomainOnPrompt = true,
}: SelectStorePromptOptions): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    outputCompleted(`Using your default dev store, ${stores[0]!.shopName}, to preview your project.`)
    return stores[0]
  }

  const storeToChoice = (store: OrganizationStore): RenderAutocompleteOptions<string>['choices'][number] => {
    let label = store.shopName
    if (showDomainOnPrompt && store.shopDomain) {
      label = `${store.shopName} (${store.shopDomain})`
    }
    return {label, value: store.shopId}
  }

  let currentStores = stores

  const extraAutocompletePromptProps: ExtraAutoCompletePropsForStoreSelect = {}
  if (onSearchForStoresByName) {
    extraAutocompletePromptProps.search = async (term) => {
      const result = await onSearchForStoresByName(term)
      currentStores = result.stores

      return {
        data: currentStores.map(storeToChoice),
        meta: {
          hasNextPage: result.hasMorePages,
        },
      }
    }
  }

  const id = await renderAutocompletePrompt({
    message: 'Which store would you like to use to view your project?',
    choices: currentStores.map(storeToChoice),
    hasMorePages,
    ...extraAutocompletePromptProps,
  })
  return currentStores.find((store) => store.shopId === id)
}

export async function confirmConversionToTransferDisabledStorePrompt(): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Make this store transfer-disabled? For security, once you use a development store to preview an app locally, the store can never be transferred to a merchant to use as a production store.`,
    confirmationMessage: 'Yes, make this store transfer-disabled permanently',
    cancellationMessage: 'No, select another store',
    defaultValue: false,
  })
}

export async function appNamePrompt(currentName: string): Promise<string> {
  return renderTextPrompt({
    message: 'App name',
    defaultValue: currentName,
    validate: (value) => {
      if (value.length === 0) {
        return "App name can't be empty"
      }
      if (value.length > APP_NAME_MAX_LENGTH) {
        return `Enter a shorter name (${APP_NAME_MAX_LENGTH} character max.)`
      }
      if (value.includes('shopify')) {
        return 'Name can\'t contain "shopify." Enter another name.'
      }
    },
  })
}

export async function reloadStoreListPrompt(org: Organization): Promise<boolean> {
  return renderConfirmationPrompt({
    message: 'Finished creating a dev store?',
    confirmationMessage: `Yes, ${org.businessName} has a new dev store`,
    cancellationMessage: 'No, cancel dev',
  })
}

export async function createAsNewAppPrompt(): Promise<boolean> {
  return renderConfirmationPrompt({
    message: 'Create this project as a new app on Shopify?',
    confirmationMessage: 'Yes, create it as a new app',
    cancellationMessage: 'No, connect it to an existing app',
  })
}

export function updateURLsPrompt(currentAppUrl: string, currentRedirectUrls: string[]): Promise<boolean> {
  return renderConfirmationPrompt({
    message: "Have Shopify automatically update your app's URL in order to create a preview experience?",
    confirmationMessage: 'Yes, automatically update',
    cancellationMessage: 'No, never',
    infoTable: {
      'Current app URL': [currentAppUrl],
      'Current redirect URLs': currentRedirectUrls,
    },
  })
}
