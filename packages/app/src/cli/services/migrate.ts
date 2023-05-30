import {fetchAppAndIdentifiers} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchTemplateSpecifications} from './generate/fetch-template-specifications.js'
import {getActiveDashboardExtensions} from './getActiveDashboardExtensions.js'
import {blocks} from '../../constants.js'
import {AppInterface} from '../models/app/app.js'
import {convertSpecificationsToTemplate} from '../models/app/template.js'
import {UIExtensionSpec} from '../models/extensions/ui.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {fileExists, findPathUp, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {hyphenate} from '@shopify/cli-kit/common/string'

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
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)
  const extensionDirectory = await ensureExtensionDirectoryExists({app: options.app, name: options.name})
  const specifications = await fetchSpecifications({token, apiKey: partnersApp.apiKey, config: options.config})
  const localTemplateSpecifications = convertSpecificationsToTemplate(specifications)
  const remoteTemplateSpecifications = await fetchTemplateSpecifications(token)
  const templateSpecs = localTemplateSpecifications.concat(remoteTemplateSpecifications)
  const specificationTypes = templateSpecs.flatMap((specification) => specification.types) ?? []
  const specification = specificationTypes.find(
    (spec) => spec.externalIdentifier === 'flow_action_definition_prototype',
  ) as UIExtensionSpec

  const activeDashboardExtensions = await getActiveDashboardExtensions({app: options.app, apiKey: partnersApp.apiKey})
  const templateDirectory =
    specification.templatePath ??
    (await findPathUp(`templates/ui-extensions/projects/${specification.identifier}`, {
      type: 'directory',
      cwd: moduleDirectory(import.meta.url),
    }))

  if (!templateDirectory) {
    throw new BugError(`Couldn't find the template for '${specification.externalName}'`)
  }

  const promises = []
  if (activeDashboardExtensions.length > 0) {
    for (const extension of activeDashboardExtensions) {
      if (extension === undefined) continue
      const srcFileExtension = 'vanilla-js'
      const extensionConfig = JSON.parse(extension.activeVersion.config)
      console.log('got extension config', extensionConfig)

      promises.push(
        recursiveLiquidTemplateCopy(templateDirectory, extensionDirectory, {
          srcFileExtension,
          flavor: extensionFlavor ?? '',
          type: specification.identifier,
          name,
          ...extensionConfig,
        }),
      )
    }
  }
  Promise.all(promises)
    .then((results) => {
      console.log('done', results)
    })
    .catch((err) => {
      console.log('error', err)
    })
}

async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = joinPath(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await fileExists(extensionDirectory)) {
    throw new AbortError(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await mkdir(extensionDirectory)
  return extensionDirectory
}
