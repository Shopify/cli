import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {Format, info} from '../../services/info.js'
import {loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class AppInfo extends Command {
  static description = 'Print basic information about your app and extensions.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    json: Flags.boolean({
      hidden: false,
      description: 'format output as JSON',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    'web-env': Flags.boolean({
      hidden: false,
      description: 'Outputs environment variables necessary for running and deploying web/.',
      env: 'SHOPIFY_FLAG_OUTPUT_WEB_ENV',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppInfo)
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      configName: flags.config,
      mode: 'report',
    })
    outputInfo(
      await info(app, {
        format: (flags.json ? 'json' : 'text') as Format,
        webEnv: flags['web-env'],
        configName: flags.config,
      }),
    )
    if (app.errors) process.exit(2)
  }
}
