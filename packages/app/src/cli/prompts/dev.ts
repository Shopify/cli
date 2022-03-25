import {error, ui} from '@shopify/cli-kit'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'

export async function selectOrganization(organizations: Organization[]): Promise<Organization> {
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
  const org = organizations.find((org: any) => org.id === choice.id)
  if (!org) {
    throw new error.Fatal('Could not find organization')
  }
  return org
}

export async function selectApp(apps: OrganizationApp[]): Promise<OrganizationApp | undefined> {
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
  if (choice.apiKey === createOption.value) return undefined
  return apps.find((app: any) => app.apiKey === choice.apiKey)
}

export async function selectStore(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
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
