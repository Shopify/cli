import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {coerce, SemVer} = require('semver')

// export {SemVer as Version}
// export {coerce as coerceSemverVersion}

/**
 * Coerces a version string to a valid semver version.
 *
 * @param version - The version to coerce.
 * @returns The coerced version.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceSemverVersion(version: string): any {
  return coerce(version)
}

/**
 * Creates a new SemVer instance.
 *
 * @param version - The version to create.
 * @returns The SemVer instance.
 */
export class Version extends SemVer {
  constructor(version: string) {
    super(coerceSemverVersion(version))
  }
}
