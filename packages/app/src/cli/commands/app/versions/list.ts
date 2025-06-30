import {appFlags} from '../../../flags.js'
import versionList from '../../../services/versions-list.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class VersionsList extends AppLinkedCommand {
  static summary = 'List deployed versions of your app.'

  static descriptionWithMarkdown = `Lists the deployed app versions. An app version is a snapshot of your app extensions.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key to fetch versions for.",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(VersionsList)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] ?? flags['api-key']

    const {app, remoteApp, developerPlatformClient, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: apiKey,
      forceRelink: flags.reset,
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
