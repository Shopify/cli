import {isTextFile} from './theme-fs.js'
import {Checksum} from '@shopify/cli-kit/node/themes/types'
import {fileHash} from '@shopify/cli-kit/node/crypto'

export function calculateChecksum(fileKey: string, fileContent: string | Buffer | undefined) {
  if (!fileContent) {
    return ''
  }

  if (Buffer.isBuffer(fileContent)) {
    return md5(fileContent)
  }

  /**
   * Settings data files are always minified before persistence, so their
   * checksum calculation accounts for that minification.
   */
  if (isSettingsData(fileKey)) {
    return minifiedJSONFileChecksum(fileContent)
  }

  return regularFileChecksum(fileKey, fileContent)
}

function minifiedJSONFileChecksum(fileContent: string) {
  let content = fileContent

  content = content.replace(/\r\n/g, '\n')
  content = content.replace(/\/\*[\s\S]*?\*\//, '')
  content = normalizeJson(content)

  return md5(content)
}

function regularFileChecksum(fileKey: string, fileContent: string) {
  let content = fileContent

  if (isTextFile(fileKey)) {
    content = content.replace(/\r\n/g, '\n')
  }

  return md5(content)
}

function normalizeJson(jsonStr: string) {
  let inStr = false
  let wasBackslash = false
  let formattedStr = ''

  for (const char of jsonStr) {
    if (char === '"' && !wasBackslash) {
      inStr = !inStr
    }

    if (!inStr && (char === ' ' || char === '\n')) {
      continue
    }

    formattedStr += char
    wasBackslash = char === '\\' && !wasBackslash
  }

  return formattedStr
}

function md5(content: string | Buffer) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)

  return fileHash(buffer)
}

/**
 * Filters out generated asset files from a list of theme checksums.
 *
 * The checksums API returns entries for both original and generated files. For
 * instance, if there's a Liquid file 'assets/basic.css.liquid', the API will
 * return entries for both 'assets/basic.css.liquid' and the generated
 * 'assets/basic.css' with the same checksum.
 *
 * Example:
 *   - key: 'assets/basic.css',        checksum: 'e4b6aac5f2af8ea6e197cc06102186e9'
 *   - key: 'assets/basic.css.liquid', checksum: 'e4b6aac5f2af8ea6e197cc06102186e9'
 *
 * This function filters out the generated files (like 'assets/basic.css'),
 * as these are not needed for theme comparison.
 */
export function rejectGeneratedStaticAssets(themeChecksums: Checksum[]) {
  return themeChecksums.filter(({key}) => {
    const isStaticAsset = key.startsWith('assets/')

    if (isStaticAsset) {
      return !hasLiquidSource(themeChecksums, key)
    }

    return true
  })
}

/**
 * Checks if a given key has a corresponding liquid source in the provided checksums.
 * @param checksums - The array of checksums to search through.
 * @param key - The key to check for a liquid source.
 * @returns True if a liquid source exists for the given key, false otherwise.
 */
function hasLiquidSource(checksums: Checksum[], key: string) {
  return checksums.some((checksum) => checksum.key === `${key}.liquid`)
}

function isSettingsData(path: string) {
  return path.endsWith('/settings_data.json')
}
