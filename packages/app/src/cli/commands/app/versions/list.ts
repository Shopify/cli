import {appFlags} from '../../../flags.js'
import {appVersionsListJsonOutputSchema, getAppVersions} from '../../../services/versions-list.js'
import {renderAppVersionsList} from '../../../services/versions-list/presenter.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class VersionsList extends AppLinkedCommand {
  static summary = 'List deployed versions of your app.'

  static descriptionWithMarkdown = `Lists the deployed app versions. An app version is a snapshot of your app extensions.`

  static get jsonOutputSchema() {
    return appVersionsListJsonOutputSchema
  }

  static description = this.descriptionForHelp()

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

    const result = await getAppVersions(developerPlatformClient, remoteApp)
    if (!result) throw new AbortError(`Invalid API Key: ${remoteApp.apiKey}`)

    if (flags.json) {
      outputResult(appVersionsListJsonOutputSchema.encode(result.appVersions))
    } else {
      await renderAppVersionsList({
        app,
        remoteApp,
        organization,
        developerPlatformClient,
        ...result,
      })
    }

    return {app}
  }
}
