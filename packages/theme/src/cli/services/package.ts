import {zip} from '@shopify/cli-kit/node/archiver'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {resolvePath, relativizePath} from '@shopify/cli-kit/node/path'
import {parseJSON} from '@shopify/theme-check-node'

const themeFilesPattern = [
  'assets/**',
  'blocks/**',
  'config/**',
  'layout/**',
  'listings/**',
  'locales/**',
  'sections/**',
  'snippets/**',
  'templates/**',
  'templates/customers/**',
  'release-notes.md',
  'update_extension.json',
].join('|')

// package is a reserved word so the function needs to be named packageTheme
export async function packageTheme(inputDirectory: string) {
  const packageName = await getThemePackageName(inputDirectory)

  const outputZipPath = `${inputDirectory}/${packageName}`
  const matchFilePattern = `${inputDirectory}/(${themeFilesPattern})`

  await zip({
    inputDirectory,
    outputZipPath,
    matchFilePattern,
  })

  renderSuccess({
    body: ['Your local theme was packaged in', {filePath: relativizePath(outputZipPath)}],
  })
}

async function getThemePackageName(inputDirectory: string) {
  const settingsPath = resolvePath(inputDirectory, 'config/settings_schema.json')

  if (!(await fileExists(settingsPath))) {
    throw new AbortError('Provide a config/settings_schema.json to package your theme.')
  }

  const themeInfo = await getThemeInfo(settingsPath)

  if (themeInfo === undefined || themeInfo.theme_name === undefined) {
    throw new AbortError('Provide a theme_info.theme_name configuration in config/settings_schema.json.')
  }

  const themeNameVersion = [themeInfo.theme_name, themeInfo.theme_version].filter(Boolean).join('-')

  return `${themeNameVersion}.zip`
}

async function getThemeInfo(settingsPath: string) {
  const parsedSettings = parseJSON(await readFile(settingsPath), null, true)

  if (!parsedSettings) {
    throw new AbortError(
      `The file config/settings_schema.json contains an error. Please check if the file is valid JSON and includes the theme_info.theme_name configuration.`,
    )
  }

  return parsedSettings.find((setting: {name: string}) => {
    return setting.name === 'theme_info'
  })
}
