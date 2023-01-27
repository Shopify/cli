import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {default: Bugsnag} = require('@bugsnag/js')

export {Bugsnag}
