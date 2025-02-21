import {AppLinkedInterface} from '../models/app/app.js'
import {AppTranslateSchema} from '../api/graphql/app_translate.js'
import {OrganizationApp, Organization} from '../models/organization.js'
import {DeveloperPlatformClient, allDeveloperPlatformClients} from '../utilities/developer-platform-client.js'
import {AppManagementClient} from '../utilities/developer-platform-client/app-management-client.js'
import {renderSuccess, renderTasks, renderInfo} from '@shopify/cli-kit/node/ui'
import {sleep} from '@shopify/cli-kit/node/system'

interface TranslateOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be translated */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  organization: Organization

  /** If true, do not prompt */
  // force: bool

  /** If true, re-translate all files */
  //  force-all: boolean
}

export async function translate(options: TranslateOptions) {
  const {developerPlatformClient, app, remoteApp, organization} = options
  const value = allDeveloperPlatformClients()
  console.log({value})
  const updatedSourceFiles = ['local/en.json (3 new keys)']
  const targetFilesToUpdate = ['locale/fr.json (3 new keys)', 'locale/es.json (3 new keys)']
  const appContext = [
    `App name: ${app.name}`,
    `App title: ${remoteApp.title}`,
    app.configuration.translations?.extra_app_context || '',
  ]
  const nonTranslatableTerms = ['MyAppName', 'Special Product', 'Some acronym', 'trademarks r us']

  const confirmInfoTable = {
    'New or updated source files': updatedSourceFiles,
    'Target files to update': targetFilesToUpdate,
    'Non translatable terms': nonTranslatableTerms,
    'Extra app context': appContext,
  }

  if (updatedSourceFiles.length === 0 && targetFilesToUpdate.length === 0) {
    renderInfo({
      headline: 'Translation update.',
      body: 'Translation files up to date',
    })
  }

  // handle more cases.  No files changed.  Force flag.
  // const confirmationResponse = await renderConfirmationPrompt({
  //   message: 'Translation update',
  //   infoTable: confirmInfoTable,
  //   confirmationMessage: `Yes, update translations`,
  //   cancellationMessage: 'No, cancel',
  // })
  // if (!confirmationResponse) throw new AbortSilentError()

  interface Context {
    appTranslate: AppTranslateSchema
  }

  // TODO: make inital network request, show a spinner, make aditional network requests.
  //   const tasks = [
  //     {
  //       title: 'Updating translations',
  //       task: async (context: Context) => {
  //         context.appTranslate = await developerPlatformClient.translate({
  //           app: remoteApp,
  //         })
  //       },
  //     },
  //   ]
  //   const renderResponse = await renderTasks<Context>(tasks)

  const appManagementClient = new AppManagementClient()
  const renderResponse = await renderTasks<Context>([
    {
      title: 'Requesting translations',
      task: async () => {
        await sleep(1)
      },
    },
    {
      title: 'Making a real network request',
      task: async (context: Context) => {
        context.appTranslate = await appManagementClient.translate({
          app: remoteApp,
        })
        await sleep(1)
      },
    },
    // {
    //   title: 'Awaiting fullfilment',
    //   task: async () => {
    //     await sleep(4)
    //   },
    // },
    // {
    //   title: 'Checking fullfilment status',
    //   task: async () => {
    //     await sleep(1)
    //   },
    // },
    // {
    //   title: 'Awaiting fullfilment',
    //   task: async () => {
    //     await sleep(4)
    //   },
    // },
    // {
    //   title: 'Checking fullfilment status',
    //   task: async () => {
    //     await sleep(1)
    //   },
    // },
    // {
    //   title: 'Updating target files',
    //   task: async () => {
    //     await sleep(1)
    //   },
    // },
  ])

  //   const {
  //     appTranslate: {appTranslate: translate},
  //   } = renderResponse

  //   const linkAndMessage: TokenItem = [
  //     {link: {label: 'versionDetails.versionTag', url: 'versionDetails.location'}},
  //     'versionDetails.message',
  //   ]

  //   if (translate.userErrors?.length > 0) {
  //     renderError({
  //       headline: 'Translation request failed.',
  //       body: [
  //         ...linkAndMessage,
  //         `${linkAndMessage.length > 0 ? '\n\n' : ''}${translate.userErrors.map((error) => error.message).join(', ')}`,
  //       ],
  //     })
  //   } else {
  renderSuccess({
    headline: 'Translation request successful.',
    body: 'Updated 342 translations across 58 target languages in 348 minutes. Please review the changes and commit them to your preferred version control system if applicable.',
  })
  //   }
}
