export {camelCase as camelize} from 'change-case'
export {paramCase as hyphenize} from 'change-case'

/** Returns a random string */
export function randomHex(size: number): string {
  let _size = size || 16
  let result = ''
  while (_size--) {
    result += Math.floor(Math.random() * 16).toString(16)
  }
  return result.toUpperCase()
}
