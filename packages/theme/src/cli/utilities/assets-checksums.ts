import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileHash} from '@shopify/cli-kit/node/crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Hash = any

export async function checksum(root: string, path: string) {
  const absolutePath = joinPath(root, path)
  const content = await readFile(absolutePath)

  if (isJson(path)) {
    const jsonContent = normalizeJson2(path, content)

    // console.log(jsonContent)

    return md5(jsonContent)
  }

  return md5(content)
}

export function normalizeJson(path: string, jsonStr: string) {
  const parsed = JSON.parse(jsonStr)

  if (isTemplate(path)) {
    visitDocument(parsed)
  }

  let keys = extractKeys(jsonStr)

  if (isTemplate(path)) {
    /**
     * Reinsert settings to force the same ordering as in the backend
     */
    keys = keys.filter((item) => item !== 'settings')
    keys.push('settings')
  }

  // eslint-disable-next-line no-console
  console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> !')

  // eslint-disable-next-line no-console
  console.log(keys)

  // // eslint-disable-next-line no-console
  // console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<')
  // // eslint-disable-next-line no-console
  // console.log(keys)

  /**
   * JSON.stringify fairly doesn't preserve the order of keys.
   *
   * However, this code ensures the original order of keys is preserved to
   * calculate the md5 following the same logic of the server side.
   */
  const normalized = stringifyOrdered(parsed, keys).replace(/\//g, '\\/')

  // eslint-disable-next-line no-console
  console.log(normalized)

  return normalized
}

export function normalizeJson2(path: string, jsonStr: string) {
  let inString = false
  let wasBackslash = false
  let formattedString = ''

  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '"' && !wasBackslash) {
      inString = !inString
    }

    if (!inString && (jsonStr[i] === ' ' || jsonStr[i] === '\n')) {
      continue
    }

    formattedString += jsonStr[i]
    wasBackslash = jsonStr[i] === '\\' && !wasBackslash
  }

  if (isConfig(path) || isLocale(path)) {
    return formattedString.replace(/\//g, '\\/')
  }

  return formattedString
}

function visitDocument(value: Hash) {
  visitHash(value.sections)
}

function visitHash(hash: Hash) {
  if (!hash || typeof hash !== 'object') return

  for (const key in hash) {
    if (Object.prototype.hasOwnProperty.call(hash, key)) {
      visitValue(hash[key])
    }
  }
}

function visitValue(value: Hash) {
  if (!value || typeof value !== 'object') return

  // Reinsert settings to force the same ordering as in the backend
  const settings = value.settings || {}
  delete value.settings
  value.settings = settings

  visitHash(value.blocks)
}

function stringifyOrdered(obj: Hash, keys: string[]): Hash {
  if (Array.isArray(obj)) {
    return stringifyArray(obj, keys)
  }

  if (obj && typeof obj === 'object') {
    return stringifyObject(obj, keys)
  }

  return JSON.stringify(obj)
}

function stringifyArray(array: unknown[], keys: string[]): string {
  return `[${array.map((element) => stringifyOrdered(element, keys)).join(',')}]`
}

function stringifyObject(obj: Hash, keys: string[]): string {
  // if (Object.keys(obj).length === 2) {
  //   // eslint-disable-next-line no-console
  //   console.log('----------------------------------')
  //   // eslint-disable-next-line no-console
  //   console.log(Object.keys(obj))
  //   // console.log(sortedKeys)
  //   // eslint-disable-next-line no-console
  //   console.log('=====')
  //   // eslint-disable-next-line no-console
  //   console.log(keys)
  //   // eslint-disable-next-line no-console
  //   console.log('=====')
  // }

  const obj2: Hash = {}

  Object.keys(obj).forEach((key) => {
    // const index = keys.indexOf(key)
    // if (index >= 0 && index < keys.length - 1) keys.splice(index, 1)
    obj2[key] = stringifyOrdered(obj[key], keys)
  })

  const sortedKeys = Object.keys(obj2).sort((x, y) => keys.indexOf(x) - keys.indexOf(y))
  // eslint-disable-next-line no-console
  console.log('=====================================')
  // eslint-disable-next-line no-console
  console.log('state', keys)
  // eslint-disable-next-line no-console
  console.log('source', Object.keys(obj2))
  // eslint-disable-next-line no-console
  console.log('sorted', sortedKeys)

  // console.log('=====')

  // console.log(sortedKeys)

  sortedKeys.forEach((sk) => {
    const index = keys.reverse().indexOf(sk)
    if (index >= 0 && index < keys.length - 1) keys.splice(index, 1)
    keys.reverse()
  })

  return `{${sortedKeys.map((key) => `"${key}":${obj2[key]}`).join(',')}}`
}

function extractKeys(jsonStr: string): string[] {
  const keys: string[] = []
  const regex = /"((?:\\.|[^"\\])*)"\s*:/g
  let match

  while ((match = regex.exec(jsonStr)) !== null) {
    if (match[1]) keys.push(match[1])
  }

  return keys
}

function isJson(path: string) {
  return path.endsWith('.json')
}

function isTemplate(path: string) {
  return path.startsWith('templates/')
}

function isConfig(path: string) {
  return path.startsWith('config/')
}

function isLocale(path: string) {
  return path.startsWith('locales/')
}

function md5(content: string) {
  const buffer = Buffer.from(content)
  return fileHash(buffer)
}
