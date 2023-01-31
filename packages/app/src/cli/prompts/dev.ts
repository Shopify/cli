import {Organization, MinimalOrganizationApp, OrganizationStore} from '../models/organization.js'
import {fetchOrgAndApps} from '../services/dev/fetch.js'
import {ui} from '@shopify/cli-kit'
import {renderAutocompletePrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {outputCompleted} from '@shopify/cli-kit/node/output'

export async function selectOrganizationPrompt(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 1) {
    return organizations[0]!
  }
  const orgList = organizations.map((org) => ({name: org.businessName, value: org.id}))
  const choice = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'id',
      message: 'Which Partners organization is this work for?',
      choices: orgList,
    },
  ])
  return organizations.find((org) => org.id === choice.id)!
}

export async function selectAppPrompt(
  apps: {pageInfo: {hasNextPage: boolean}; nodes: MinimalOrganizationApp[]},
  orgId: string,
  token: string,
): Promise<string> {
  const toAnswer = (app: MinimalOrganizationApp) => ({label: app.title, value: app.apiKey})
  const appList = apps.nodes.map(toAnswer)

  return renderAutocompletePrompt({
    message: 'Which existing app is this for?',
    choices: appList,
    hasMorePages: apps.pageInfo.hasNextPage,
    search: async (term) => {
      const result = await fetchOrgAndApps(orgId, token, term)

      return {
        data: result.apps.nodes.map(toAnswer),
        meta: {
          hasNextPage: result.apps.pageInfo.hasNextPage,
        },
      }
    },
  })
}

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    outputCompleted(`Using your default dev store (${stores[0]!.shopName}) to preview your project.`)
    return stores[0]
  }
  const storeList = stores.map((store) => ({name: store.shopName, value: store.shopId}))

  const choice = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'id',
      message: 'Which store would you like to use to view your project?',
      choices: storeList,
    },
  ])
  return stores.find((store) => store.shopId === choice.id)
}

export async function appTypePrompt(): Promise<'public' | 'custom'> {
  const options = [
    {name: 'Public: An app built for a wide merchant audience.', value: 'public'},
    {name: 'Custom: An app custom built for a single client.', value: 'custom'},
  ]

  const choice: {value: 'public' | 'custom'} = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'What type of app are you building?',
      choices: options,
    },
  ])
  return choice.value
}

export async function appNamePrompt(currentName: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'App Name',
      default: currentName,
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
        return true
      },
    },
  ])
  return input.name
}

export async function reloadStoreListPrompt(org: Organization): Promise<boolean> {
  const options = [
    {name: `Yes, ${org.businessName} has a new dev store`, value: 'reload'},
    {name: 'No, cancel dev', value: 'cancel'},
  ]

  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'Finished creating a dev store?',
      choices: options,
    },
  ])
  return choice.value === 'reload'
}

export async function createAsNewAppPrompt(): Promise<boolean> {
  const options = [
    {name: 'Yes, create it as a new app', value: 'yes'},
    {name: 'No, connect it to an existing app', value: 'cancel'},
  ]

  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'Create this project as a new app on Shopify?',
      choices: options,
    },
  ])
  return choice.value === 'yes'
}

export async function reuseDevConfigPrompt(): Promise<boolean> {
  const options = [
    {name: 'Yes, deploy in the same way', value: 'yes'},
    {name: 'No, use a different org or app', value: 'cancel'},
  ]

  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'Deploy to the same org and app as you used for dev?',
      choices: options,
    },
  ])
  return choice.value === 'yes'
}

export function updateURLsPrompt(currentAppUrl: string, currentRedirectUrls: string[]): Promise<string> {
  const choices = [
    {label: 'Always by default', value: 'always'},
    {label: 'Yes, this time', value: 'yes'},
    {label: 'No, not now', value: 'no'},
    {label: `Never, don't ask again`, value: 'never'},
  ]

  const infoTable = {
    'Current app URL': [currentAppUrl],
    'Current redirect URLs': currentRedirectUrls,
  }

  return renderSelectPrompt({
    message: `Have Shopify automatically update your app's URL in order to create a preview experience?`,
    choices,
    infoTable,
  })
}

export async function tunnelConfigurationPrompt(): Promise<'always' | 'yes' | 'cancel'> {
  const options = [
    {name: 'Always use it by default', value: 'always'},
    {name: 'Use it now and ask me next time', value: 'yes'},
    {name: 'Nevermind, cancel dev', value: 'cancel'},
  ]

  const choice: {value: 'always' | 'yes' | 'cancel'} = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'How would you like your tunnel to work in the future?',
      choices: options,
    },
  ])
  return choice.value
}
