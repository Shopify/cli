import {Organization, MinimalOrganizationApp, OrganizationStore} from '../models/organization.js'
import {fetchOrgAndApps} from '../services/dev/fetch.js'
import {output, system, ui} from '@shopify/cli-kit'

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

export async function selectAppPrompt(apps: MinimalOrganizationApp[], orgId: string, token: string): Promise<MinimalOrganizationApp> {
  const appsByApiKey: {[apiKey: string]: MinimalOrganizationApp} = {}
  const addToApiKeyCache = (apps: MinimalOrganizationApp[]) => apps.forEach((app) => appsByApiKey[app.apiKey] = app)
  addToApiKeyCache(apps)
  const toAnswer = (app: MinimalOrganizationApp) => ({name: app.title, value: app.apiKey})
  const appList = apps.map(toAnswer)

  /* allInputs serves as a LIFO stack, so we always can pop off the latest input
   * as the most urgent search term, then fill in intermediate steps in the
   * background.
   * latestRequest tracks the most recent input, so we know which result should
   * be displayed at all times.
   */
  const allInputs = ['']
  let latestRequest: string

  /* Set up an event loop, searching for apps using the latest user input once
   * per second to avoid hitting rate limits.
   * If we don't have any previously unseen input to search for, return without
   * action.
   */
  let cachedResults: {[input: string]: MinimalOrganizationApp[]} = {'': apps}
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const fetchInterval = setInterval(async () => {
    let input: string | undefined
    do {
      input = allInputs.pop()
      if (input === undefined) return
    } while (cachedResults[input])
    const result = await fetchOrgAndApps(orgId, token, input)
    addToApiKeyCache(result.apps)
    // eslint-disable-next-line require-atomic-updates
    cachedResults[input] = result.apps
  }, 1000)

  const choice = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'apiKey',
      message: 'Which existing app is this for?',
      choices: appList,
      /* filterFunction is a local filter-and-search, to be applied to the
       * results from the remote search for proper sorting and display.
       * This source function wraps the local function in a function that
       * fetches remote results when appropriate.
       */
      source: (filterFunction: ui.FilterFunction): ui.FilterFunction => {
        const cachedFiltered: {[input: string]: ui.PromptAnswer[]} = {'': appList}
        return async (_answers: ui.PromptAnswer[], input = '') => {
          // Only perform remote search for apps if we haven't fetched them all
          if (appList.length < 100) return filterFunction(appList, input)

          latestRequest = input
          allInputs.push(input)
          // Await the event loop returning a result
          while (!cachedResults[input]) {
            // eslint-disable-next-line no-await-in-loop
            await system.sleep(0.2)
          }

          // Cache the answerified results to avoid race conditions
          if (!cachedFiltered[input]) {
            // eslint-disable-next-line require-atomic-updates
            cachedFiltered[input] = await filterFunction(cachedResults[input]!.map(toAnswer), input)
          }

          /* If the user types "hello" we will have this function running 5
           * times, for each substring ("h", "he", "hel", "hell", "hello").
           * If the latest input "hello" is available, display that result.
           * Otherwise, display the result of whatever intermediate step is
           * available, so the user at least sees something is happening.
           */
          return cachedFiltered[latestRequest] || cachedFiltered[input]!
        }
      },
    },
  ])
  clearInterval(fetchInterval)
  return appsByApiKey[choice.apiKey]!
}

export async function selectStorePrompt(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  if (stores.length === 1) {
    output.completed(`Using your default dev store (${stores[0]!.shopName}) to preview your project.`)
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

export async function updateURLsPrompt(): Promise<string> {
  const options = [
    {name: 'Always by default', value: 'always'},
    {name: 'Yes, this time', value: 'yes'},
    {name: 'No, not now', value: 'no'},
    {name: `Never, don't ask again`, value: 'never'},
  ]

  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: `Have Shopify automatically update your app's URL in order to create a preview experience?`,
      choices: options,
    },
  ])
  return choice.value
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
