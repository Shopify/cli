import {appFlags} from '../../../flags.js'
import securitySubmit from '../../../services/security-submit.js'
import {encodeSecuritySubmitJson, toSecuritySubmitJson} from '../../../services/security-submit-json.js'
import {securitySubmitFailure} from '../../../services/security-submit-result.js'
import {renderSecuritySubmitResult} from '../../../services/security-submit-output.js'
import {Flags} from '@oclif/core'
import BaseCommand, {type NonTTYFlagRequirement} from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {SecuritySubmitResult} from '../../../services/security-submit-result.js'

export default class SecuritySubmit extends BaseCommand {
  static hidden = true

  static summary = 'Submit App Security results to Shopify.'

  static descriptionWithMarkdown = `Reads the most recent App Security trace, writes a \`.shopify/app-security/submission.json\` file for inspection, asks for confirmation, and uploads the result to Shopify.

Generated report fields exclude source code, file paths, code snippets, evidence, finding messages, and commit identifiers. Optional feedback is included without redaction. Optionally use \`--version\` to identify the app version corresponding to the scanned files. Use \`--dry-run\` to write and inspect the exact payload without uploading it.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    config: appFlags.config,
    'client-id': appFlags['client-id'],
    ...jsonFlag,
    version: Flags.string({
      hidden: false,
      description: 'Optional app version corresponding to the files used to generate these results.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    feedback: Flags.string({
      description: 'Optional feedback about inaccurate or unhelpful App Security results. Use - to read from stdin.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_FEEDBACK',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation. Required if non interactive.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Write the submission payload without uploading it.',
      env: 'SHOPIFY_FLAG_APP_SECURITY_DRY_RUN',
      default: false,
    }),
  }

  static nonTTYFlagRequirements(): NonTTYFlagRequirement[] {
    // Dry runs never upload. JSON mode uses the service preflight guard so failures are rendered as JSON.
    return [{flags: ['force'], when: (flags) => !flags['dry-run'] && !flags.json}]
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecuritySubmit)

    let result: SecuritySubmitResult
    try {
      result = await securitySubmit({
        directory: flags.path,
        json: flags.json,
        force: flags.force,
        dryRun: flags['dry-run'],
        clientId: flags['client-id'],
        configName: flags.config,
        versionTag: flags.version,
        feedback: flags.feedback,
      })
    } catch (error) {
      const failure = securitySubmitFailure(error, 'preparation')
      if (!failure) throw error
      result = failure
    }

    if (result.status === 'cancelled') return
    if (flags.json) {
      outputResult(encodeSecuritySubmitJson(toSecuritySubmitJson(result)))
      if (result.status === 'failed') process.exitCode = 1
    } else {
      renderSecuritySubmitResult(result)
    }
  }
}
