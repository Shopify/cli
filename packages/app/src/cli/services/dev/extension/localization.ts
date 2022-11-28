import {UIExtension} from '../../../models/app/extensions.js'
import {path, file, output} from '@shopify/cli-kit'
import {ExtensionPayload, Status} from '@shopify/ui-extensions-server-kit'
import type {GetUIExtensionPayloadOptions} from './payload.js'

type Localization = ExtensionPayload['localization']

export async function getLocalizationFilePaths(extension: UIExtension): Promise<string[]> {
  const localePath = path.join(extension.directory, 'locales')
  return path.glob([path.join(localePath, '*.json')])
}

export async function getLocalization(
  extension: UIExtension,
  options: GetUIExtensionPayloadOptions,
): Promise<{localization: Localization; status: Status}> {
  const localeFiles = await getLocalizationFilePaths(extension)

  if (!localeFiles.length) {
    return {localization: undefined, status: Status.Unknown}
  }

  const localization = defaultLocalizationIfUndefined(options.currentLocalizationPayload)
  const compilingTranslations = []

  for (const path of localeFiles) {
    const [locale, ...fileNameSegments] = (path.split('/').pop() as string).split('.')

    if (locale) {
      if (fileNameSegments[0] === 'default') {
        localization.defaultLocale = locale
      }

      compilingTranslations.push(compileLocalizationFiles(locale, path, localization, extension, options))
    }
  }

  let status = Status.Success

  await Promise.all(compilingTranslations)
    .then(async () => {
      localization.lastUpdated = Date.now()
      output.info(
        `Parsed locales for extension ${extension.configuration.name} at ${extension.directory}`,
        options.stdout,
      )
    })
    .catch(() => {
      status = Status.Error
    })

  return {
    localization,
    status,
  }
}

function defaultLocalizationIfUndefined(localization: Localization) {
  return localization
    ? localization
    : {
        defaultLocale: 'en',
        translations: {},
        lastUpdated: 0,
      }
}

async function compileLocalizationFiles(
  locale: string,
  path: string,
  localization: ReturnType<typeof defaultLocalizationIfUndefined>,
  extension: UIExtension,
  options: GetUIExtensionPayloadOptions,
): Promise<void> {
  try {
    localization.translations[locale] = JSON.parse(await file.read(path))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const message = `Error parsing ${locale} locale for ${extension.configuration.name} at ${path}: ${error.message}`
    await output.warn(message, options.stderr)
    throw new Error(message)
  }
}
