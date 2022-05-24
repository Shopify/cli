import {Organization, OrganizationApp, OrganizationStore} from '../models/organization'
import {output, ui} from '@shopify/cli-kit'

export async function selectOrganizationPrompt(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 1) {
    return organizations[0]
  }
  const orgList = organizations.map((org) => ({name: org.businessName, value: org.id}))
  const questions: ui.Question = {
    type: 'autocomplete',
    name: 'id',
    message: 'Which Partners organization is this work for?',
    choices: orgList,
  }
  const choice: {id: string} = await ui.prompt([questions])
  return organizations.find((org: any) => org.id === choice.id)!
}

export async function selectAppPrompt(apps: OrganizationApp[]): Promise<OrganizationApp> {
  const appList = apps.map((app) => ({name: app.title, value: app.apiKey}))
  const questions: ui.Question = {
    type: 'autocomplete',
    name: 'apiKey',
    message: 'Which existing app is this for?',
    choices: appList,
  }
  const choice: {apiKey: string} = await ui.prompt([questions])
  return apps.find((app: any) => app.apiKey === choice.apiKey)!
}

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    output.completed(`Using your default dev store (${stores[0].shopName}) to preview your project`)
    return stores[0]
  }
  const storeList = stores.map((store) => ({name: store.shopName, value: store.shopId}))

  const questions: ui.Question = {
    type: 'autocomplete',
    name: 'id',
    message: 'Which development store would you like to use to view your project?',
    choices: storeList,
  }
  const choice: {id: string} = await ui.prompt([questions])
  return stores.find((store: any) => store.shopId === choice.id)
}

export async function appNamePrompt(currentName: string): Promise<string> {
  const questions: ui.Question = {
    type: 'input',
    name: 'name',
    message: 'App Name',
    default: currentName,
    validate: (value) => {
      if (value.length === 0) {
        return "App Name can't be empty"
      }
      if (value.length > 30) {
        return 'App name is too long (maximum is 30 characters)'
      }
      if (value.includes('shopify')) {
        return 'Invalid app name'
      }
      return true
    },
  }
  const input: {name: string} = await ui.prompt([questions])
  return input.name
}

export async function reloadStoreListPrompt(): Promise<boolean> {
  const options = [
    {name: 'Yes, reload stores', value: 'reload'},
    {name: 'No, cancel dev', value: 'cancel'},
  ]

  const questions: ui.Question = {
    type: 'select',
    name: 'value',
    message: 'Would you like to reload your store list to retrieve your recently created store?',
    choices: options,
  }
  const choice: {value: string} = await ui.prompt([questions])
  return choice.value === 'reload'
}

export async function createAsNewAppPrompt(): Promise<boolean> {
  const options = [
    {name: 'Yes, create it as a new app', value: 'yes'},
    {name: 'No, connect it to an existing app', value: 'cancel'},
  ]

  const questions: ui.Question = {
    type: 'select',
    name: 'value',
    message: 'Create this project as a new app on Shopify?',
    choices: options,
  }
  const choice: {value: string} = await ui.prompt([questions])
  return choice.value === 'yes'
}
