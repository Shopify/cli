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

export async function selectConfigName(directory: string, defaultName = ''): Promise<string> {
  const namePromptOptions = buildTextPromptOptions(defaultName)
  let configName = await renderTextPrompt(namePromptOptions)

  while (await fileExists(joinPath(directory, filenameFromName(configName)))) {
    const askAgain = await renderConfirmationPrompt({
      message: `Configuration file ${filenameFromName(
        configName,
      )} already exists. Do you want to choose a different configuration name?`,
      confirmationMessage: "Yes, I'll choose a different name",
      cancellationMessage: 'No, overwrite my existing configuration file',
    })

    if (askAgain) {
      configName = await renderTextPrompt(namePromptOptions)
    } else {
      break
    }
  }

  return filenameFromName(configName)
}

function filenameFromName(name: string, highlight = false): string {
  const slugifiedName = slugify(name)
  if (slugifiedName === '') return 'shopify.app.toml'
  const configName = highlight ? colors.cyan(slugifiedName) : slugifiedName
  return `shopify.app.${configName}.toml`
}

export async function findConfigFiles(directory: string): Promise<string[]> {
  return glob(joinPath(directory, 'shopify.app*.toml'))
}

export async function selectConfigFile(directory: string): Promise<Result<string, string>> {
  const files = (await findConfigFiles(directory)).map((path) => basename(path))

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

function buildTextPromptOptions(initialAnswer: string): RenderTextPromptOptions {
  return {
    message: 'Configuration file name:',
    initialAnswer,
    validate,
    preview: (value) => `${filenameFromName(value, true)} will be generated in your root directory`,
  }
}

export function validate(value: string): string | undefined {
  const result = slugify(value)
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
