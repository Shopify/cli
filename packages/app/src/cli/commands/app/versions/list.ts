import {appFlags} from '../../../flags.js'
import versionList from '../../../services/versions-list.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class VersionsList extends AppCommand {
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

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(VersionsList)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    const {app, remoteApp, developerPlatformClient, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: apiKey,
      forceRelink: false,
      userProvidedConfigName: flags.config,
    })

    await versionList({
      app,
      remoteApp,
      organization,
      developerPlatformClient,
      json: flags.json,
    })

    return {app}
  }
}
