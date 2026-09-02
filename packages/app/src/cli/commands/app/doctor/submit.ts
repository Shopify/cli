import {appFlags} from '../../../flags.js'
import doctorSubmit from '../../../services/doctor-submit.js'
import {Flags} from '@oclif/core'
import BaseCommand, {type NonTTYFlagRequirement} from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class DoctorSubmit extends BaseCommand {
  static hidden = true

  static summary = 'Submit App Doctor results to Shopify.'

  static descriptionWithMarkdown = `Reads the most recent App Doctor trace, writes a redacted \`.shopify/app-doctor/submission.json\` file for inspection, asks for confirmation, and uploads the result to Shopify.

No source code, file paths, snippets, or commit identifiers are sent. Optional \`--version\` and \`--source-control-url\` metadata is included only when supplied. Use \`--dry-run\` to write and inspect the exact payload without uploading it.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: appFlags.path,
    config: appFlags.config,
    'client-id': appFlags['client-id'],
    ...jsonFlag,
    version: Flags.string({
      hidden: false,
      description:
        'Optional version tag that will be associated with this app version. If not provided, an auto-generated identifier will be generated for this app version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    'source-control-url': Flags.string({
      hidden: false,
      description: 'URL associated with the new app version.',
      env: 'SHOPIFY_FLAG_SOURCE_CONTROL_URL',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation. Required if non interactive.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Write the submission payload without uploading it.',
      env: 'SHOPIFY_FLAG_APP_DOCTOR_DRY_RUN',
      default: false,
    }),
  }

  static nonTTYFlagRequirements(): NonTTYFlagRequirement[] {
    // Dry runs never upload, so they may run non-interactively without --force.
    return [{flags: ['force'], when: (flags) => !flags['dry-run']}]
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DoctorSubmit)

    await doctorSubmit({
      directory: flags.path,
      json: flags.json,
      force: flags.force,
      dryRun: flags['dry-run'],
      clientId: flags['client-id'],
      configName: flags.config,
      versionTag: flags.version,
      sourceControlUrl: flags['source-control-url'],
    })
  }
}
