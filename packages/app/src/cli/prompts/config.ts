/* eslint-disable no-await-in-loop */
import {PushOptions} from '../services/app/config/push.js'
import {AppSchema, CurrentAppConfiguration, getAppScopesArray} from '../models/app/app.js'
import {mergeAppConfiguration} from '../services/app/config/link.js'
import {OrganizationApp} from '../models/organization.js'
import {App} from '../api/graphql/get_config.js'
import {rewriteConfiguration} from '../services/app/write-app-configuration-file.js'
import {
  RenderTextPromptOptions,
  renderConfirmationPrompt,
  renderInfo,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {fileExists, glob} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {slugify} from '@shopify/cli-kit/common/string'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {deepCompare, deepDifference} from '@shopify/cli-kit/common/object'
import colors from '@shopify/cli-kit/node/colors'

export async function selectConfigName(directory: string, defaultName = ''): Promise<string> {
  const namePromptOptions = buildTextPromptOptions(defaultName)
  let configName = slugify(await renderTextPrompt(namePromptOptions))

  while (await fileExists(joinPath(directory, `shopify.app.${configName}.toml`))) {
    const askAgain = await renderConfirmationPrompt({
      message: `Configuration file shopify.app.${configName}.toml already exists. Do you want to choose a different configuration name?`,
      confirmationMessage: "Yes, I'll choose a different name",
      cancellationMessage: 'No, overwrite my existing configuration file',
    })

    if (askAgain) {
      configName = slugify(await renderTextPrompt(namePromptOptions))
    } else {
      break
    }
  }

  return configName
}

export async function selectConfigFile(directory: string): Promise<Result<string, string>> {
  const files = (await glob(joinPath(directory, 'shopify.app*.toml'))).map((path) => basename(path))

  if (files.length === 0) return err('Could not find any shopify.app.toml file in the directory.')
  if (files.length === 1) return ok(files[0]!)

  const chosen = await renderSelectPrompt({
    message: 'Configuration file',
    choices: files.map((file) => {
      return {label: file, value: file}
    }),
  })

  return ok(chosen)
}

function buildTextPromptOptions(defaultValue: string): RenderTextPromptOptions {
  return {
    message: 'Configuration file name:',
    defaultValue,
    validate,
    preview: (value) => `shopify.app.${colors.cyan(slugify(value))}.toml will be generated in your root directory`,
  }
}

export function validate(value: string): string | undefined {
  const result = slugify(value)
  if (result.length === 0) return `The file name can't be empty.`
  // Max filename size for Windows/Mac including the prefix/postfix
  if (result.length > 238) return 'The file name is too long.'
}

export async function confirmPushChanges(options: PushOptions, app: App) {
  if (options.force) return true

  const configuration = options.configuration as CurrentAppConfiguration
  const remoteConfiguration = mergeAppConfiguration(configuration, app as OrganizationApp)

  if (configuration.access_scopes?.scopes)
    configuration.access_scopes.scopes = getAppScopesArray(configuration).join(',')

  const [updated, baseline] = deepDifference(
    {...(rewriteConfiguration(AppSchema, configuration) as object), build: undefined},
    {...(rewriteConfiguration(AppSchema, remoteConfiguration) as object), build: undefined},
  )

  if (deepCompare(updated, baseline)) {
    renderInfo({headline: 'No changes to update.'})
    return false
  }

  const baselineContent = encodeToml(baseline)
  const updatedContent = encodeToml(updated)

  return renderConfirmationPrompt({
    message: ['Make the following changes to your remote configuration?'],
    gitDiff: {
      baselineContent,
      updatedContent,
    },
    defaultValue: true,
    confirmationMessage: 'Yes, confirm changes',
    cancellationMessage: 'No, cancel',
  })
}
