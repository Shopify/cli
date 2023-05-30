import {fetchAppAndIdentifiers} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchTemplateSpecifications} from './generate/fetch-template-specifications.js'
import {getActiveDashboardExtensions} from './getActiveDashboardExtensions.js'
import {ExtensionInitOptions, generateExtension} from './generate/extension.js'
import {AppInterface} from '../models/app/app.js'
import {convertSpecificationsToTemplate} from '../models/app/template.js'
import {UIExtensionSpec} from '../models/extensions/ui.js'
import {GenericSpecification} from '../models/app/extensions.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

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

  const activeDashboardExtensions = await getActiveDashboardExtensions({app: options.app, apiKey: partnersApp.apiKey})

  if (activeDashboardExtensions.length > 0) {
    for (const extension of activeDashboardExtensions) {
      if (extension === undefined) continue
      const extensionConfig = JSON.parse(extension.activeVersion.config)
      console.log('got extension config', extensionConfig)

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
      await generateExtension(generateExtensionOptions, options.app)
    }
  }
}
