import {Organization, OrganizationApp, OrganizationStore} from '../models/organization'
import {output, ui} from '@shopify/cli-kit'

export async function selectOrganizationPrompt(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 1) {
    return organizations[0]
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

export async function selectAppPrompt(apps: OrganizationApp[]): Promise<OrganizationApp> {
  const appList = apps.map((app) => ({name: app.title, value: app.apiKey}))
  const choice = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'apiKey',
      message: 'Which existing app is this for?',
      choices: appList,
    },
  ])
  return apps.find((app) => app.apiKey === choice.apiKey)!
}

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    output.completed(`Using your default dev store (${stores[0].shopName}) to preview your project`)
    return stores[0]
  }
  const storeList = stores.map((store) => ({name: store.shopName, value: store.shopId}))

  const choice = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'id',
      message: 'Which development store would you like to use to view your project?',
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

export async function reloadStoreListPrompt(): Promise<boolean> {
  const options = [
    {name: 'Yes, reload my stores', value: 'reload'},
    {name: 'No, cancel dev', value: 'cancel'},
  ]

  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'Have you created a new dev store?',
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
