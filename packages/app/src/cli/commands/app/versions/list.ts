import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import versionList from '../../../services/versions-list.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AppInterface} from '../../../models/app/app.js'
import {loadApp} from '../../../models/app/loader.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class VersionsList extends Command {
  static summary = 'List deployed versions of your app.'

  static descriptionWithMarkdown = `Lists the deployed app versions. An app version is a snapshot of your app extensions.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key to fetch versions for.",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID to fetch versions for.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    json: Flags.boolean({
      description: 'Output the versions list as JSON.',
      default: false,
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  static args = {
    file: Args.string(),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(VersionsList)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({specifications, directory: flags.path, configName: flags.config})

    await versionList({
      app,
      apiKey,
      reset: false,
      json: flags.json,
    })
  }
}
