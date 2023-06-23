import {ensureReleaseContext} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {AppRelease, AppReleaseSchema, AppReleaseVariables} from '../api/graphql/app_release.js'
import {confirmReleasePrompt} from '../prompts/release.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderError, renderSuccess, renderTasks, TokenItem} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** App version tag */
  version: string
}

export async function release(options: ReleaseOptions) {
  validateOptions(options)
  const {token, apiKey, app} = await ensureReleaseContext(options)

  await confirmReleasePrompt(app.name)
  interface Context {
    appRelease: AppReleaseSchema
  }

  const variables: AppReleaseVariables = {
    apiKey,
    versionTag: options.version,
  }

  const tasks = [
    {
      title: 'Releasing version',
      task: async (context: Context) => {
        context.appRelease = await partnersRequest(AppRelease, token, variables)
      },
    },
  ]

  const {
    appRelease: {appRelease: release},
  } = await renderTasks<Context>(tasks)

  let linkAndMessage: TokenItem = []
  if (release.deployment) {
    linkAndMessage = [
      {link: {label: release.deployment.versionTag, url: release.deployment.location}},
      release.deployment.message ? `\n${release.deployment.message}` : '',
    ]
  }

  if (release.userErrors?.length > 0) {
    renderError({
      headline: "Version couldn't be released",
      body: [
        ...linkAndMessage,
        `${linkAndMessage.length > 0 ? '\n\n' : ''}${release.userErrors.map((error) => error.message).join(', ')}`,
      ],
    })
  } else {
    renderSuccess({
      headline: 'Version released to users.',
      body: linkAndMessage,
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'shopify app versions list')},
          'to see rollout progress.',
        ],
      ],
    })
  }
}

export function validateOptions({version}: Partial<ReleaseOptions>) {
  if (version) {
    const versionMaxLength = 100
    if (version.length > versionMaxLength) {
      throw new AbortError({
        bold: `Version must be less than ${versionMaxLength} characters`,
      })
    }

    const invalidCompleteWords = ['.', '..']
    if (invalidCompleteWords.find((invalidCompleteWord) => version === invalidCompleteWord)) {
      throw new AbortError({
        bold: `Version should be different from '${invalidCompleteWords.join("' , '")}'`,
      })
    }

    const validChars = /^[a-zA-Z0-9.\-/_]+$/
    if (!version.match(validChars)) {
      throw new AbortError(
        {
          bold: 'Version includes invalid characters',
        },
        ["Supported characters are 'a-z' 'A-Z' '0-9' '.' '-' '_' and '/'"],
      )
    }
  }
}
