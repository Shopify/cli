import {fileExists, readFile, glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {capitalizeWords} from '@shopify/cli-kit/common/string'
import {AbortError} from '@shopify/cli-kit/node/error'
import {parseJSON} from '@shopify/theme-check-node'

function isListingFile(fileKey: string): boolean {
  return (fileKey.startsWith('templates/') || fileKey.startsWith('sections/')) && fileKey.endsWith('.json')
}

export async function getListingFilePath(
  themeDirectory: string,
  listingName: string,
  fileKey: string,
): Promise<string | undefined> {
  if (isListingFile(fileKey)) {
    const listingFilePath = joinPath(themeDirectory, 'listings', listingName, fileKey)

    if (await fileExists(listingFilePath)) {
      return listingFilePath
    }
  }

  return undefined
}

export async function updateSettingsDataForListing(themeDirectory: string, listingName: string): Promise<string> {
  const settingsDataPath = joinPath(themeDirectory, 'config', 'settings_data.json')
  const settingsContent = await readFile(settingsDataPath, {encoding: 'utf8'})

  const settingsData = parseJSON(settingsContent, null, true)

  // If JSON parsing fails, return original content
  if (!settingsData) {
    return settingsContent
  }

  settingsData.current = capitalizeWords(listingName)

  return JSON.stringify(settingsData, null, 2)
}

export async function ensureListingExists(themeDirectory: string, listingName: string): Promise<void> {
  const listingsRoot = joinPath(themeDirectory, 'listings')
  const dir = joinPath(listingsRoot, listingName)
  const exists = await fileExists(dir)
  if (exists) return

  let available: string[] = []
  if (await fileExists(listingsRoot)) {
    available = await glob('*', {cwd: listingsRoot, onlyDirectories: true, deep: 1})
  }

  const availablePresetsMessage =
    available.length > 0
      ? `Available presets: ${available
          .map((presetDirectoryName) => `"${capitalizeWords(presetDirectoryName)}"`)
          .join(', ')}`
      : 'No presets found under "listings/"'

  throw new AbortError(
    `Listing preset "${listingName}" was not found. ${availablePresetsMessage}.`,
    `Add the preset to config/settings_data.json and its corresponding "listings/${listingName}" folder, or remove the --listing flag to use the default theme settings.`,
  )
}
