import {isThemeAsset, isJson, readThemeFile, isTextFile} from './theme-fs.js'
import {Checksum} from '@shopify/cli-kit/node/themes/types'
import {fileHash} from '@shopify/cli-kit/node/crypto'

export async function checksum(root: string, path: string) {
  let content = await readThemeFile(root, path)

  if (!content) return ''

  if (Buffer.isBuffer(content)) return md5(content)

  if (isTextFile(path)) content = content.replace(/\r\n/g, '\n')

  if (isJson(path)) {
    content = normalizeJson(content)

    /**
     * The backend (Assets API) escapes forward slashes for internal JSON
     * assets such as templates/*.json, sections/*.json, config/*.json.
     *
     * To maintain consistency in checksum calculation, we follow the same
     * approach here (note that already escaped forward slashes are not
     * re-escaped).
     */
    if (!isThemeAsset(path)) {
      content = content.replace(/(?<!\\)\//g, '\\/')
    }
  }

  return md5(content)
}

export function normalizeJson(jsonStr: string) {
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
export function rejectLiquidChecksums(themeChecksums: Checksum[]) {
  return themeChecksums.filter(({key}) => {
    const isStaticAsset = key.startsWith('assets/')

    if (isStaticAsset) {
      return !themeChecksums.some((checksum) => checksum.key === `${key}.liquid`)
    }

    return true
  })
}
