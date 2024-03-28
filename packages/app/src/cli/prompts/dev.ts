import {
  Organization,
  MinimalOrganizationApp,
  OrganizationStore,
  MinimalAppIdentifiers,
  MinimalRunEvent,
} from '../models/organization.js'
import {getTomls} from '../utilities/app/config/getTomls.js'
import {setCachedCommandInfo} from '../services/local-storage.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderAutocompletePrompt, renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
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

export async function selectRunPrompt(runs: MinimalRunEvent[]): Promise<MinimalRunEvent> {
  const toAnswer = (run: MinimalRunEvent) => {
    return {label: run.payload.invocationId, value: run}
  }

  const runsList = runs.map(toAnswer)

  const selectedRun = await renderAutocompletePrompt({
    message: 'Select a run',
    choices: runsList,
  })
  return selectedRun
}

export async function selectAppPrompt(
  developerPlatformClient: DeveloperPlatformClient,
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  orgId: string,
  options?: {
    directory?: string
  },
): Promise<MinimalAppIdentifiers> {
  const tomls = await getTomls(options?.directory)

  if (tomls) setCachedCommandInfo({tomls})

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
      const result = await developerPlatformClient.appsForOrg(orgId, term)
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

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    outputCompleted(`Using your default dev store, ${stores[0]!.shopName}, to preview your project.`)
    return stores[0]
  }
  const storeList = stores.map((store) => ({label: store.shopName, value: store.shopId}))

  const id = await renderAutocompletePrompt({
    message: 'Which store would you like to use to view your project?',
    choices: storeList,
  })
  return stores.find((store) => store.shopId === id)
}

export async function appNamePrompt(currentName: string): Promise<string> {
  return renderTextPrompt({
    message: 'App name',
    defaultValue: currentName,
    validate: (value) => {
      if (value.length === 0) {
        return "App name can't be empty"
      }
      if (value.length > 30) {
        return 'Enter a shorter name (30 character max.)'
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

export async function reuseDevConfigPrompt(): Promise<boolean> {
  return renderConfirmationPrompt({
    message: 'Deploy to the same org and app as you used for dev?',
    confirmationMessage: 'Yes, deploy in the same way',
    cancellationMessage: 'No, use a different org or app',
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
