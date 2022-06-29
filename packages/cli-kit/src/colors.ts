import {createRequire} from 'module'

/**
 * ansi-colors is a commonjs dependency that can be imported as a module.
 * This file is a wrapper to require and export ansi-colors.
 */
const require = createRequire(import.meta.url)
export const colors = require('ansi-colors')
