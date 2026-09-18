import {appFlags} from '../../../flags.js'
import {getAppDoctorStatus, writeAppDoctorStatusResult} from '../../../services/app-doctor-status.js'
import {appDoctorStatusJsonOutputSchema} from '../../../services/app-doctor-status-json.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'

export default class DoctorStatus extends BaseCommand {
  static hidden = true

  static summary = 'Show recorded App Doctor results for an app configuration.'

  static descriptionWithMarkdown = `Reads the App Doctor results stored for an app configuration and reports them. No scan is performed and no source files are read: the results describe the app as it was when each result was recorded, so a changed tree is not reflected until it is reviewed again.

Each check can hold a result from two modes. Static results come from the \`shopify app doctor\` scan. Agent results come from a coding agent that followed \`shopify app doctor instructions\` and stored its findings with \`shopify app doctor record\`. A check with no result in a mode is reported as not run, never as passed. Findings are listed with their suppression state, and a score is only given when static coverage is complete.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    path: appFlags.path,
    config: appFlags.config,
    'client-id': appFlags['client-id'],
  }

  static get jsonOutputSchema() {
    return appDoctorStatusJsonOutputSchema
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DoctorStatus)

    const result = await getAppDoctorStatus({
      directory: flags.path,
      configName: flags.config,
      clientId: flags['client-id'],
      interactive: isTerminalInteractive(),
    })
    writeAppDoctorStatusResult(result, flags.json ? 'json' : 'text')
  }
}
