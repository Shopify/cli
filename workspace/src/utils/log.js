import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const colors = require('ansi-colors')

export function logSection(title) {
  console.info(colors.green.bold(title))
}

export function logMessage(message) {
  console.info(colors.gray(`  ${message}`))
}
