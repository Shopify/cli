import semver from 'semver'

import {CheckResult} from '../../../../../types'
import Command from '../../../../../core/Command'

const NODE_MIN_VERSION = '>=12.0.0'

export async function checkNodeVersion(this: Command): Promise<CheckResult[]> {
  const nodeVersion = await this.package.nodeVersion()
  const normalizedVersion = semver.coerce(nodeVersion)?.version

  return [
    {
      id: 'node-version',
      type: 'Dependencies',
      description: 'Has min node version',
      success:
        !nodeVersion ||
        (normalizedVersion !== undefined &&
          semver.satisfies(normalizedVersion, NODE_MIN_VERSION)),
      link: 'https://shopify.dev/custom-storefronts/hydrogen/support',
    },
  ]
}
