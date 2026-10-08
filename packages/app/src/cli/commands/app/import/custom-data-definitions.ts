import {appFlags} from '../../../flags.js'
import {checkFolderIsValidApp} from '../../../models/app/loader.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {importDeclarativeDefinitions} from '../../../services/generate/shop-import/declarative-definitions.js'
import {importCustomDataDefinitionsJsonOutputSchema} from '../../../services/generate/shop-import/declarative-definitions/types.js'
import {renderImportDeclarativeDefinitionsResult} from '../../../services/generate/shop-import/declarative-definitions/result.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {extractMyshopifyHandle} from '@shopify/cli-kit/common/url'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'

export default class ImportCustomDataDefinitions extends AppLinkedCommand {
  static summary = 'Import metafield and metaobject definitions.'

  static descriptionWithMarkdown = `Import metafield and metaobject definitions from your development store. [Read more about declarative custom data definitions](https://shopify.dev/docs/apps/build/custom-data/declarative-custom-data-definitions).`

  static get jsonOutputSchema() {
    return importCustomDataDefinitionsJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'include-existing': Flags.boolean({
      description: 'Include existing declared definitions in the output.',
      default: false,
      env: 'SHOPIFY_FLAG_INCLUDE_EXISTING',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {appContextResult, json, ...options} = await renderSingleTask({
      title: outputContent`Loading application`,
      task: async () => {
        const {flags} = await this.parse(ImportCustomDataDefinitions)

        await checkFolderIsValidApp(flags.path)

        const appContextResult = await linkedAppContext({
          directory: flags.path,
          clientId: flags['client-id'],
          forceRelink: flags.reset,
          userProvidedConfigName: flags.config,
        })
        const store = await storeContext({
          appContextResult,
          storeFqdn: flags.store,
          forceReselectStore: flags.reset,
        })

        return {
          appContextResult,
          json: flags.json,
          appConfiguration: appContextResult.app.configuration,
          remoteApp: appContextResult.remoteApp,
          store,
          includeExistingDeclaredDefinitions: flags['include-existing'],
        }
      },
    })
    const result = await importDeclarativeDefinitions(options)
    if (json) {
      const storeHandle = extractMyshopifyHandle(result.storeDomain)
      outputResult(
        importCustomDataDefinitionsJsonOutputSchema.encode({
          status: result.status,
          storeDomain: storeHandle ? `${storeHandle}.myshopify.com` : null,
          metafieldCount: result.metafieldCount,
          metaobjectCount: result.metaobjectCount,
          toml: result.tomlContent,
          skippedSections: result.skippedSections.map((section) =>
            section.type === 'metafields' ? {type: section.type, ownerType: section.ownerType} : {type: section.type},
          ),
        }),
      )
    } else {
      renderImportDeclarativeDefinitionsResult(result)
    }

    return {app: appContextResult.app}
  }
}
