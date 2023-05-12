import {zip} from '@shopify/cli-kit/node/archiver'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {resolvePath, relativizePath} from '@shopify/cli-kit/node/path'

const themeFilesPattern = [
  'assets/**',
  'config/**',
  'layout/**',
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

  const parsedSettings = JSON.parse(await readFile(settingsPath))
  const themeInfo = parsedSettings.find((setting: {name: string}) => setting.name === 'theme_info')

  if (themeInfo === undefined || themeInfo.theme_name === undefined) {
    throw new AbortError('Provide a theme_info.theme_name configuration in config/settings_schema.json')
  }

  const themeNameVersion = [themeInfo.theme_name, themeInfo.theme_version].filter(Boolean).join('-')

  return `${themeNameVersion}.zip`
}
