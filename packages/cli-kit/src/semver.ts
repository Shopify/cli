import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {coerce, satisfies, SemVer} = require('semver')

export {coerce, satisfies, SemVer as Version}
