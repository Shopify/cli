/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
const SemVer = require('semver/classes/semver')

/** Error that is thrown when the version used to initialize Version has an invalid format */
export class InvalidVersionError extends Error {}

// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/semver/classes/semver.d.ts
interface SemVerInterface {
  raw: string
  loose: boolean
  major: number
  minor: number
  patch: number
  version: string
  build: ReadonlyArray<string>
  prerelease: ReadonlyArray<string | number>

  format(): string
  inspect(): string

  /**
   * Compares two versions excluding build identifiers (the bit after `+` in the semantic version string).
   *
   * @return
   * - `0` if `this` == `other`
   * - `1` if `this` is greater
   * - `-1` if `other` is greater.
   */
  compare(other: string | SemVerInterface): 1 | 0 | -1

  /**
   * Compares the release portion of two versions.
   *
   * @return
   * - `0` if `this` == `other`
   * - `1` if `this` is greater
   * - `-1` if `other` is greater.
   */
  compareMain(other: string | SemVerInterface): 1 | 0 | -1

  /**
   * Compares the prerelease portion of two versions.
   *
   * @return
   * - `0` if `this` == `other`
   * - `1` if `this` is greater
   * - `-1` if `other` is greater.
   */
  comparePre(other: string | SemVerInterface): 1 | 0 | -1

  /**
   * Compares the build identifier of two versions.
   *
   * @return
   * - `0` if `this` == `other`
   * - `1` if `this` is greater
   * - `-1` if `other` is greater.
   */
  compareBuild(other: string | SemVerInterface): 1 | 0 | -1
}

/** A class that represents a semantic version */
// @ts-ignore
export class Version extends SemVer implements SemVerInterface {
  constructor(version: string) {
    try {
      super(version)
    } catch (error: any) {
      throw new InvalidVersionError(error.message)
    }
  }
}
