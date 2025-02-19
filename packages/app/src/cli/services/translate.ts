import {configExtensionsIdentifiersBreakdown} from './context/breakdown-extensions.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AppTranslateSchema} from '../api/graphql/app_translate.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderError, renderSuccess, renderTasks, TokenItem} from '@shopify/cli-kit/node/ui'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be released */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, proceed with deploy without asking for confirmation */
  //   force: boolean

  /** App version tag */
  //   version: string
}

export async function translate(options: ReleaseOptions) {
  const {developerPlatformClient, app, remoteApp} = options
  console.log('find me 1')

  console.log({developerPlatformClient, app, remoteApp})
  const configExtensionIdentifiersBreakdown = await configExtensionsIdentifiersBreakdown({
    developerPlatformClient,
    apiKey: remoteApp.apiKey,
    localApp: app,
    remoteApp,
  })

  console.log({configExtensionIdentifiersBreakdown})
  //   const confirmed = await deployOrReleaseConfirmationPrompt({
  //     configExtensionIdentifiersBreakdown,
  //     extensionIdentifiersBreakdown,
  //     appTitle: remoteApp.title,
  //     release: true,
  //     // eslint-disable-next-line line-comment-position
  //     force: false, // options.force,
  //   })
  //   if (!confirmed) throw new AbortSilentError()
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

  console.log({renderResponse})
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
