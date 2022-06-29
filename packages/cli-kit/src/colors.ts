import {createRequire} from 'module'

const require = createRequire(import.meta.url)
export const colors = require('ansi-colors')
