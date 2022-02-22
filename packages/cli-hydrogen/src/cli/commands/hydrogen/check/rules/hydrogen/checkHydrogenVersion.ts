import semver from 'semver'

import {CheckResult} from '../../../../../types'
import addHydrogen from '../../../add/hydrogen'
import Command from '../../../../../core/Command'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import hydrogenPkg from '../../../../../../../package.json'

export const HYDROGEN_MIN_VERSION = hydrogenPkg.version

export async function checkHydrogenVersion(
  this: Command,
): Promise<CheckResult[]> {
  const h2Version = await this.package.hasDependency('@shopify/hydrogen')
  const normalizedVersion = h2Version
    ? semver.coerce(h2Version)?.version
    : `@shopify/hydrogen not installed`
  const latestHydrogen =
    typeof h2Version === 'string' &&
    typeof normalizedVersion === 'string' &&
    semver.gte(normalizedVersion, HYDROGEN_MIN_VERSION)

  const success = h2Version === 'latest' || latestHydrogen

  const description = `Has latest hydrogen version (latest: ${HYDROGEN_MIN_VERSION} / found ${normalizedVersion})`

  return [
    {
      id: 'hydrogen-latest',
      type: 'Dependencies',
      description,
      success,
      fix: addHydrogen,
    },
  ]
}
