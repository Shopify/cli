/* eslint-disable no-await-in-loop */
import {AppSchema, CurrentAppConfiguration} from '../models/app/app.js'
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
import {zod} from '@shopify/cli-kit/node/schema'

export interface DiffContent {
  baselineContent: string
  updatedContent: string
}

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

export function buildDiffConfigContent(
  localConfig: CurrentAppConfiguration,
  remoteConfig: unknown,
  schema: zod.ZodTypeAny = AppSchema,
  renderNoChanges = true,
) {
  const [updated, baseline] = deepDifference(
    {...(rewriteConfiguration(schema, localConfig) as object), build: undefined},
    {...(rewriteConfiguration(schema, remoteConfig) as object), build: undefined},
  )

  if (deepCompare(updated, baseline)) {
    if (renderNoChanges) renderInfo({headline: 'No changes to update.'})
    return undefined
  }

  return {
    baselineContent: encodeToml(baseline),
    updatedContent: encodeToml(updated),
  }
}
