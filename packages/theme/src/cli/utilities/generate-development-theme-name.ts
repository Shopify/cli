import {replaceInvalidCharacters} from './replace-invalid-characters.js'
import {hostname as osHostName} from 'os'
import {randomBytes as cryptoRandomBytes} from 'crypto'

const API_NAME_LIMIT = 50

export function generateDevelopmentThemeName(hostName = osHostName, randomBytes = cryptoRandomBytes): string {
  const hostNameWithoutDomain = hostName().split('.')[0]!
  const hash = randomBytes(3).toString('hex')

  const name = 'Development ()'
  const hostNameCharacterLimit = API_NAME_LIMIT - name.length - hash.length
  const identifier = replaceInvalidCharacters(`${hash}-${hostNameWithoutDomain.substring(0, hostNameCharacterLimit)}`)
  return `Development (${identifier})`
}
