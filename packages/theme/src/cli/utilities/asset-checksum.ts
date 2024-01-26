import {isThemeAsset, isJson, readThemeFile, isTextFile} from './theme-fs.js'
import {fileHash} from '@shopify/cli-kit/node/crypto'

export async function checksum(root: string, path: string) {
  let content = await readThemeFile(root, path)

  if (!content) return ''

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

function md5(content: string) {
  const buffer = Buffer.from(content)

  return fileHash(buffer)
}
