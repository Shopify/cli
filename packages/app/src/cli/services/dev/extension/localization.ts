import {ExtensionAssetBuildStatus} from './payload/models.js'
import {UIExtension} from '../../../models/app/extensions.js'
import {path, file, output} from '@shopify/cli-kit'

export type Locale = string

export interface Localization {
  // TOOD: Should this be strongly typed?
  defaultLocale: Locale
  translations: {
    [key: Locale]: {[key: string]: string}
  }
  lastUpdated: number
}

export async function getLocalizationFilePaths(extension: UIExtension): Promise<string[]> {
  const localePath = path.join(extension.directory, 'locales')
  return path.glob([path.join(localePath, '*.json')])
}

export async function getLocalization(
  extension: UIExtension,
): Promise<{localization: Localization | undefined; status: ExtensionAssetBuildStatus}> {
  const localeFiles = await getLocalizationFilePaths(extension)

  if (!localeFiles.length) {
    return {localization: undefined, status: 'success'}
  }

  const localization = {
    defaultLocale: 'en',
    translations: {},
    lastUpdated: 0,
  } as Localization

  const compilingTranslations = []
  const calculatingLastUpdatedAts = []

  for (const path of localeFiles) {
    const [locale, ...fileNameSegments] = (path.split('/').pop() as string).split('.')

    if (locale) {
      if (fileNameSegments[0] === 'default') {
        localization.defaultLocale = locale
      }

      compilingTranslations.push(compileLocalizationFiles(locale, path, localization, extension))
      calculatingLastUpdatedAts.push(calculateLastUpdatedTimestamp(path, localization))
    }
  }

  let status: ExtensionAssetBuildStatus = 'success'

  await Promise.all(compilingTranslations).catch(() => {
    status = 'error'
  })
  await Promise.all(calculatingLastUpdatedAts).catch(() => {
    status = 'error'
  })

  if (status === 'success') {
    await output.debug(`Parsed locales for extension ${extension.configuration.name} at ${extension.directory}`)
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
  extension: UIExtension,
): Promise<void> {
  try {
    localization.translations[locale] = JSON.parse(await file.read(path))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const message = `Error parsing ${locale} locale for ${extension.configuration.name} at ${path}: ${error.message}`
    await output.warn(message)
    throw new Error(message)
  }
}

async function calculateLastUpdatedTimestamp(path: string, localization: Localization) {
  const lastUpdatedDateTime = await file.lastUpdatedTimestamp(path)

  if (lastUpdatedDateTime > localization.lastUpdated) {
    localization.lastUpdated = lastUpdatedDateTime
  }
}
