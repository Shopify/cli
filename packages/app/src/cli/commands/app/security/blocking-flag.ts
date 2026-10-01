import {Flags} from '@oclif/core'
import type {AppSecurityBlockingLevel} from '../../../services/app-security-api.js'

const blockingLevels: AppSecurityBlockingLevel[] = ['high', 'medium', 'low', 'none']

/**
 * `--blocking`, shared by `check` and `review` so both accept the same levels and default.
 * `Flags.custom` types the parsed value as an `AppSecurityBlockingLevel`, so the commands don't cast it.
 */
export const appSecurityBlockingFlag = {
  blocking: Flags.custom<AppSecurityBlockingLevel>({
    description: 'The minimum finding severity that causes a non-zero exit code.',
    options: blockingLevels,
    default: 'none',
    env: 'SHOPIFY_FLAG_APP_SECURITY_BLOCKING',
  })(),
}
