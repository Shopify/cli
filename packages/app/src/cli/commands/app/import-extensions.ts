import {appFlags} from '../../flags.js'
import {allExtensionTypes, importExtensions} from '../../services/import-extensions.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {getMigrationChoices, selectMigrationChoice} from '../../prompts/import-extensions.js'
import {getExtensions} from '../../services/fetch-extensions.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class ImportExtensions extends AppLinkedCommand {
  static description = 'Import dashboard-managed extensions into your app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ImportExtensions)
    const appContext = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const extensions = await getExtensions({
      developerPlatformClient: appContext.developerPlatformClient,
      apiKey: appContext.remoteApp.apiKey,
      organizationId: appContext.remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
    })

    const migrationChoices = getMigrationChoices(extensions)

    if (migrationChoices.length === 0) {
      renderSuccess({headline: ['No extensions to migrate.']})
    } else {
      const migrationChoice = await selectMigrationChoice(migrationChoices)
      await importExtensions({
        ...appContext,
        extensions,
        extensionTypes: migrationChoice.extensionTypes,
        buildTomlObject: migrationChoice.buildTomlObject,
      })
    }

    return {app: appContext.app}
  }
}
