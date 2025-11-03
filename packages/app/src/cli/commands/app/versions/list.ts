import {appFlags} from '../../../flags.js'
import versionList from '../../../services/versions-list.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class VersionsList extends AppLinkedCommand {
  static summary = 'List deployed versions of your app.'

  static descriptionWithMarkdown = `Lists the deployed app versions. An app version is a snapshot of your app extensions.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(VersionsList)

    const {app, remoteApp, developerPlatformClient, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
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
