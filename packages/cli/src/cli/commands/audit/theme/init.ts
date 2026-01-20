import {runThemeAudit} from '../../../services/audit/theme/runner.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class AuditThemeInit extends Command {
  static description = 'Run theme init audit test'
  static hidden = true

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    const results = await runThemeAudit({
      only: ['theme:init'],
    })

    // Exit with error code if any tests failed
    const failed = results.some((result) => result.status === 'failed')
    if (failed) {
      process.exitCode = 1
    }
  }
}
