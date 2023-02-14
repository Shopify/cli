import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {coerce, SemVer} = require('semver')

export {SemVer as Version}
export {coerce as coerceSemverVersion}
