import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {capitalCase} from 'change-case'

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

  try {
    const settingsData = JSON.parse(settingsContent)
    settingsData.current = capitalCase(listingName)

    return JSON.stringify(settingsData, null, 2)
  } catch (error) {
    // If JSON parsing fails, return original content
    if (error instanceof SyntaxError) {
      return settingsContent
    }

    throw error
  }
}
