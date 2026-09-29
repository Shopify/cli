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

  static summary = 'Send App Security results and feedback to Shopify.'

  static descriptionWithMarkdown = `Sends the App Security results that \`shopify app security review\` shows to Shopify, with your optional feedback. Reads \`.shopify/app-security/deterministic-findings.json\` and, when present, \`agent-findings.json\`, writes \`.shopify/app-security/submission.json\` for inspection, and asks for confirmation before uploading.

The upload excludes source code, file paths, code snippets, evidence, finding messages, agent reasoning and reasons, suppression justifications, and commit identifiers. Feedback is sent without redaction. Optionally use \`--version\` to identify the app version these results came from. Use \`--dry-run\` to write and inspect the exact payload without uploading it.`

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
      description: 'Optional feedback about these App Security results or this tool. Use - to read from stdin.',
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
