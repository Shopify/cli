import {replaceInvalidCharacters} from './replace-invalid-characters.js'
import {hostname} from 'os'
import {randomBytes} from 'crypto'

const API_NAME_LIMIT = 50

export function generateDevelopmentThemeName(): string {
  const hostNameWithoutDomain = hostname().split('.')[0]!
  const hash = randomBytes(3).toString('hex')

  const name = 'Development ()'
  const hostNameCharacterLimit = API_NAME_LIMIT - name.length - hash.length
  const identifier = replaceInvalidCharacters(`${hash}-${hostNameWithoutDomain.substring(0, hostNameCharacterLimit)}`)
  return `Development (${identifier})`
}
