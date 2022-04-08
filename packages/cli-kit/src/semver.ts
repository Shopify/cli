import Semver from 'semver/classes/semver'

/** Error that is thrown when the version used to initialize Version has an invalid format */
export class InvalidVersionError extends Error {}

/** A class that represents a semantic version */
export class Version extends Semver {
  constructor(version: string) {
    try {
      super(version)
    } catch (error: any) {
      throw new InvalidVersionError(error.message)
    }
  }
}
