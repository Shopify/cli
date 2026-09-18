import {appFlags} from '../../../flags.js'
import {recordAppDoctorReview, writeAppDoctorRecordResult} from '../../../services/app-doctor-record.js'
import {appDoctorRecordJsonOutputSchema} from '../../../services/app-doctor-record-json.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class DoctorRecord extends BaseCommand {
  static hidden = true

  static summary = "Record a coding agent's App Doctor review."

  static descriptionWithMarkdown = `Stores the findings documents a coding agent wrote after following \`shopify app doctor instructions\`. No prior \`shopify app doctor\` scan is required: each review token carries the app configuration, the scope directory, and the exact check prompts the agent received, and the command refuses documents that don't match this CLI or this app.

Pass one \`--review\` token with one \`--findings\` file for each reviewed scope, in the same order; the pairs are matched by position and the whole command is rejected when any pair is invalid, so nothing is stored partially. Recording replaces any earlier agent results for the same scopes and checks; static scan results are kept separately and are not touched. Run \`shopify app doctor status\` afterwards to read the stored results back.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    path: appFlags.path,
    config: appFlags.config,
    'client-id': appFlags['client-id'],
    // oclif hands an environment value to a `multiple` flag as one unsplit string, so the variables can only
    // express a single --review/--findings pair. Multiple scopes must be passed as repeated flags.
    review: Flags.string({
      multiple: true,
      required: true,
      description: 'Review token from the instructions for one scope (repeatable; pair each with --findings).',
      env: 'SHOPIFY_FLAG_APP_DOCTOR_RECORD_REVIEW',
    }),
    findings: Flags.string({
      multiple: true,
      required: true,
      description: 'Findings document the agent wrote for the matching --review token (repeatable).',
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_APP_DOCTOR_RECORD_FINDINGS',
    }),
  }

  static get jsonOutputSchema() {
    return appDoctorRecordJsonOutputSchema
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DoctorRecord)

    const result = await recordAppDoctorReview({
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      reviews: flags.review,
      findings: flags.findings,
      interactive: isTerminalInteractive(),
    })
    writeAppDoctorRecordResult(result, flags.json ? 'json' : 'text')
  }
}
