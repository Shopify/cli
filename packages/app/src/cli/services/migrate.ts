import {fetchAppAndIdentifiers} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchTemplateSpecifications} from './generate/fetch-template-specifications.js'
import {ExtensionInitOptions, GeneratedExtension, generateExtension} from './generate/extension.js'
import {getActiveDashboardExtensions} from './getActiveDashboardExtensions.js'
import {AppInterface} from '../models/app/app.js'
import {convertSpecificationsToTemplate} from '../models/app/template.js'
import {UIExtensionSpec} from '../models/extensions/ui.js'
import {GenericSpecification} from '../models/app/extensions.js'
import migratePrompt from '../prompts/migrate.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'

interface MigrateOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** The deployment label */
  label?: string
  config: Config
}

interface DashboardExtension {
  id: string
  uuid: string
  title: string
  type: string
  activeVersion: {
    id: string
    uuid: string
    config: string
  }
}

export async function migrate(options: MigrateOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, _] = await fetchAppAndIdentifiers(options, token)
  const specifications = await fetchSpecifications({token, apiKey: partnersApp.apiKey, config: options.config})
  const localTemplateSpecifications = convertSpecificationsToTemplate(specifications)
  const remoteTemplateSpecifications = await fetchTemplateSpecifications(token)
  const templateSpecs = localTemplateSpecifications.concat(remoteTemplateSpecifications)
  const specificationTypes = templateSpecs.flatMap((specification) => specification.types) ?? []
  const specification = specificationTypes.find(
    (spec) => spec.externalIdentifier === 'flow_action_definition_prototype',
  ) as UIExtensionSpec

  const activeDashboardExtensions: (DashboardExtension | undefined)[] = await getActiveDashboardExtensions({
    app: options.app,
    apiKey: partnersApp.apiKey,
  })

  const generatedExtensions = [] as GeneratedExtension[]

  if (activeDashboardExtensions.length > 0) {
    const promptOptions = await buildPromptOptions(activeDashboardExtensions)
    const promptAnswer = await migratePrompt(promptOptions)

    const extensionsToMigrate =
      promptAnswer === 'All'
        ? activeDashboardExtensions
        : [activeDashboardExtensions.find((ext) => ext?.title === promptAnswer)]

    for (const extension of extensionsToMigrate) {
      if (extension === undefined) continue
      const extensionConfig = JSON.parse(extension.activeVersion.config)

      const generateExtensionOptions: ExtensionInitOptions<GenericSpecification>[] = [
        {
          name: extension.title,
          specification,
          app: options.app,
          extensionType: specification.identifier,
          extensionConfig,
        },
      ]

      // eslint-disable-next-line no-await-in-loop
      const generatedExtension = await generateExtension(generateExtensionOptions, options.app)
      generatedExtensions.push(...generatedExtension)
    }
    renderSuccessMessages(generatedExtensions)
  } else {
    renderSuccess({
      headline: ['No extensions to migrate'],
    })
  }
}
async function buildPromptOptions(extensions: (DashboardExtension | undefined)[]): Promise<string[]> {
  const names = extensions.map((ext) => ext?.title).filter((name) => name !== undefined) as string[]
  names.push('All')

  return names
}

function renderSuccessMessages(generatedExtensions: GeneratedExtension[]) {
  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(extension.specification, extension.directory)
    renderSuccess(formattedSuccessfulMessage)
  })
}

function formatSuccessfulRunMessage(
  specification: GenericSpecification,
  extensionDirectory: string,
): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extensionDirectory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (specification.helpURL) {
    options.reference!.push(['For more details, see the', {link: {label: 'docs', url: specification.helpURL}}])
  }

  return options
}
