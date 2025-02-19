import {AppLinkedInterface} from '../models/app/app.js'
import {AppTranslateSchema} from '../api/graphql/app_translate.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {
  renderError,
  renderSuccess,
  renderTasks,
  TokenItem,
  renderConfirmationPrompt,
  renderInfo,
} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface TranslateOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be translated */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, do not prompt */
  // force: bool

  /** If true, re-translate all files */
  //  force-all: boolean
}

export async function translate(options: TranslateOptions) {
  const {developerPlatformClient, app, remoteApp} = options

  // Example of how to get the app's current configration.
  console.log({
    // I'm not sure we need both of these.
    title: remoteApp.title,
    name: app.name,

    // Pulls this from the app's TOML file.
    // [translations]
    // extra_app_context = "this app is funny"
    extraAppContext: app.configuration.translations?.extra_app_context,
  })

  const newSourceFiles: string[] = []
  const updatedSourceFiles = ['local/en.json']
  const targetFilesToUpdate = ['locale/fr.json']

  const confirmInfoTable = {
    'New source files': newSourceFiles,
    'Updated source files': updatedSourceFiles,
    'Target files to update': targetFilesToUpdate,
  }

  if (newSourceFiles.length === 0 && updatedSourceFiles.length === 0 && targetFilesToUpdate.length === 0) {
    renderInfo({
      headline: 'Translation update.',
      body: 'Translation files up to date',
    })
  }

  // handle more cases.  No files changed.  Force flag.
  const confirmationResponse = await renderConfirmationPrompt({
    message: 'Translation update',
    infoTable: confirmInfoTable,
    confirmationMessage: `Yes, update translations`,
    cancellationMessage: 'No, cancel',
  })
  if (!confirmationResponse) throw new AbortSilentError()

  interface Context {
    appTranslate: AppTranslateSchema
  }

  const tasks = [
    {
      title: 'Updating translations',
      task: async (context: Context) => {
        context.appTranslate = await developerPlatformClient.translate({
          app: remoteApp,
        })
      },
    },
  ]
  const renderResponse = await renderTasks<Context>(tasks)

  const {
    appTranslate: {appTranslate: translate},
  } = renderResponse

  const linkAndMessage: TokenItem = [
    {link: {label: 'versionDetails.versionTag', url: 'versionDetails.location'}},
    'versionDetails.message',
  ]

  if (translate.userErrors?.length > 0) {
    renderError({
      headline: 'Translation request failed.',
      body: [
        ...linkAndMessage,
        `${linkAndMessage.length > 0 ? '\n\n' : ''}${translate.userErrors.map((error) => error.message).join(', ')}`,
      ],
    })
  } else {
    renderSuccess({
      headline: 'Translation request succeeded.',
      body: linkAndMessage,
    })
  }
}
