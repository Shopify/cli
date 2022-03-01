export {camelCase as camelize} from 'change-case'
export {paramCase as hyphenize} from 'change-case'

/** Returns a random string */
export function random(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}
