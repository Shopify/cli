import {Organization, MinimalOrganizationApp, OrganizationStore, MinimalAppIdentifiers} from '../models/organization.js'
import {getTomls} from '../utilities/app/config/getTomls.js'
import {Paginateable} from '../utilities/developer-platform-client.js'
import {APP_NAME_MAX_LENGTH} from '../models/app/validation/common.js'
import {ApplicationURLs} from '../services/dev/urls.js'
import {
  devStoreNamePrompt as sharedDevStoreNamePrompt,
  devStorePlanPrompt as sharedDevStorePlanPrompt,
} from '@shopify/organizations'
import {
  RenderAutocompleteOptions,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {outputCompleted} from '@shopify/cli-kit/node/output'
import type {DevStorePlan} from '@shopify/organizations'

export function devStoreNamePrompt(): Promise<string> {
  return sharedDevStoreNamePrompt()
}

export function devStorePlanPrompt(): Promise<DevStorePlan> {
  return sharedDevStorePlanPrompt()
}

export async function selectAppPrompt(
  onSearchForAppsByName: (term: string) => Promise<{apps: MinimalOrganizationApp[]; hasMorePages: boolean}>,
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  options?: {
    directory?: string
  },
): Promise<MinimalAppIdentifiers | undefined> {
  const tomls = await getTomls(options?.directory)

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

  return currentAppChoices.find((app) => app.apiKey === apiKey)
}

interface SelectStorePromptOptions {
  onSearchForStoresByName?: (term: string) => Promise<Paginateable<{stores: OrganizationStore[]}>>
  stores: OrganizationStore[]
  hasMorePages?: boolean
  showDomainOnPrompt: boolean
  onCreateStoreWhenEmpty?: () => Promise<OrganizationStore | undefined>
  onCreateStore?: () => Promise<OrganizationStore | undefined>
}

interface ExtraAutoCompletePropsForStoreSelect {
  search?: RenderAutocompleteOptions<string>['search']
}

export async function selectStorePrompt({
  stores,
  hasMorePages = false,
  onSearchForStoresByName,
  showDomainOnPrompt = true,
  onCreateStoreWhenEmpty,
  onCreateStore,
}: SelectStorePromptOptions): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return onCreateStoreWhenEmpty?.()
  if (stores.length === 1 && !onCreateStore) {
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
  const storesById = new Map(stores.map((store) => [store.shopId, store]))
  const createStoreChoice = '__create_new_dev_store__'
  const choices = () => [
    ...currentStores.map(storeToChoice),
    ...(onCreateStore ? [{label: 'Create a new dev store', value: createStoreChoice}] : []),
  ]

  const extraAutocompletePromptProps: ExtraAutoCompletePropsForStoreSelect = {}
  if (onSearchForStoresByName) {
    extraAutocompletePromptProps.search = async (term) => {
      const result = await onSearchForStoresByName(term)
      currentStores = result.stores
      if (currentStores.length > 0) {
        currentStores.forEach((store) => storesById.set(store.shopId, store))
      }

      return {
        data: choices(),
        meta: {
          hasNextPage: result.hasMorePages,
        },
      }
    }
  }

  const id = await renderAutocompletePrompt({
    message: 'Which store would you like to use to view your project?',
    choices: choices(),
    hasMorePages,
    ...extraAutocompletePromptProps,
  })
  if (id === createStoreChoice) return onCreateStore?.()
  return storesById.get(id)
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

export function updateURLsPrompt(currentAppUrl: string, newURLs: ApplicationURLs): Promise<boolean> {
  const affectedConfigs = ['application_url', 'redirect_urls']
  if (newURLs.appProxy?.proxyUrl) {
    affectedConfigs.push('app_proxy')
  }

  const infoTable: {[key: string]: string[]} = {
    'Currently released app URL': [currentAppUrl],
    '=> Dev URL': [newURLs.applicationUrl],
    'Affected configurations': affectedConfigs,
  }

  return renderConfirmationPrompt({
    message:
      "Have Shopify override your app URLs when running `app dev` against your dev store? This won't affect your app on other stores",
    confirmationMessage: 'Yes, automatically update',
    cancellationMessage: 'No, never',
    infoTable,
  })
}

export function generateCertificatePrompt() {
  return renderConfirmationPrompt({
    message: '--use-localhost requires a certificate for `localhost`. Generate it now?',
    confirmationMessage: 'Yes, use mkcert to generate it',
    cancellationMessage: "No, I'll run `app dev` again without `--use-localhost`",
  })
}
