import {ExtensionAssetBuildStatus} from './payload/models.js'
import {GetUIExtensionPayloadOptions} from './payload.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile, glob} from '@shopify/cli-kit/node/fs'
import {ExtendableError} from '@shopify/cli-kit/node/error'
import {outputInfo, outputWarn} from '@shopify/cli-kit/node/output'

type Locale = string

export interface Localization {
  // TOOD: Should this be strongly typed?
  defaultLocale: Locale
  translations: {
    [key: Locale]: {[key: string]: string}
  }
  lastUpdated: number
}

async function getLocalizationFilePaths(extension: ExtensionInstance): Promise<string[]> {
  const localePath = joinPath(extension.directory, 'locales')
  return glob([joinPath(localePath, '*.json')])
}

export async function getLocalization(
  extension: ExtensionInstance,
  options: GetUIExtensionPayloadOptions,
): Promise<{localization: Localization | undefined; status: ExtensionAssetBuildStatus}> {
  const localeFiles = await getLocalizationFilePaths(extension)

  if (!localeFiles.length) {
    return {localization: undefined, status: ''}
  }

  const localization = options.currentLocalizationPayload
    ? options.currentLocalizationPayload
    : ({
        defaultLocale: 'en',
        translations: {},
        lastUpdated: 0,
      } as Localization)

  let status: ExtensionAssetBuildStatus = 'success'

  try {
    await Promise.all(
      localeFiles.map(async (localeFile) => {
        const [locale, ...fileNameSegments] = (localeFile.split('/').pop() as string).split('.')

        if (locale) {
          if (fileNameSegments[0] === 'default') {
            localization.defaultLocale = locale
          }

          return compileLocalizationFiles(locale, localeFile, localization, extension, options)
        }
      }),
    )
    localization.lastUpdated = Date.now()
    outputInfo(`Parsed locales for extension ${extension.handle} at ${extension.directory}`, options.stdout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-catch-all/no-catch-all
  } catch (error: any) {
    status = 'error'
  }

  return {
    localization,
    status,
  }
}

async function compileLocalizationFiles(
  locale: string,
  path: string,
  localization: Localization,
  extension: ExtensionInstance,
  options: GetUIExtensionPayloadOptions,
): Promise<void> {
  let localeContent: string | undefined
  try {
    localeContent = await readFile(path)
    localization.translations[locale] = JSON.parse(localeContent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const message = `Error parsing ${locale} locale for ${extension.handle} at ${path}: ${error.message}`
    outputWarn(message, options.stderr)
    throw new ExtendableError(message)
  }
}
