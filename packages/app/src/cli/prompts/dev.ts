import {ui} from '@shopify/cli-kit'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'

export async function selectOrganizationPrompt(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 1) {
    return organizations[0]
  }
  const orgList = organizations.map((org) => ({name: org.businessName, value: org.id}))
  const questions: ui.Question = {
    type: 'select',
    name: 'id',
    message: 'Which org would you like to work in?',
    choices: orgList,
  }
  const choice: {id: string} = await ui.prompt([questions])
  return organizations.find((org: any) => org.id === choice.id)!
}

export async function selectAppPrompt(apps: OrganizationApp[]): Promise<OrganizationApp | undefined> {
  if (apps.length === 0) return undefined
  const appList = apps.map((app) => ({name: app.title, value: app.apiKey}))
  const createOption = {name: 'Create a new app', value: 'create'}
  appList.push(createOption)
  const questions: ui.Question = {
    type: 'select',
    name: 'apiKey',
    message: 'Which existing app would you like to connect this work to?',
    choices: appList,
  }
  const choice: {apiKey: string} = await ui.prompt([questions])
  return apps.find((app: any) => app.apiKey === choice.apiKey)
}

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) return stores[0]
  const storeList = stores.map((store) => ({name: store.shopName, value: store.shopId}))

  const questions: ui.Question = {
    type: 'select',
    name: 'id',
    message: 'Where would you like to view your project? Select a dev store',
    choices: storeList,
  }
  const choice: {id: string} = await ui.prompt([questions])
  return stores.find((store: any) => store.shopId === choice.id)
}
