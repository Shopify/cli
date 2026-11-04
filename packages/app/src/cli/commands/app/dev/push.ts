import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {devPush} from '../../../services/dev-push.js'
import {appDevPushJsonOutputSchema} from '../../../services/dev-push/types.js'
import {renderDevPushResult} from '../../../services/dev-push/result.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {Flags} from '@oclif/core'
import {safeParseURL} from '@shopify/cli-kit/common/url'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class DevPush extends AppLinkedCommand {
  static summary = 'Pushes a dev preview without running local servers.'

  static descriptionWithMarkdown = `Builds and uploads a snapshot of your app configuration and extensions to a development store, then exits. It does not release an app version or start local servers, tunnels, or file watchers.

  Deploy your web backend separately. Use \`--url\` to apply its public HTTPS origin to the preview using the same app URL, OAuth callback, and app proxy rewriting as \`app dev\`. The override does not rewrite your TOML files. Without \`--url\`, the preview uses your configured URLs.

  Use \`shopify app dev clean\` to restore the app's released version.`

  static jsonOutputSchema = appDevPushJsonOutputSchema

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'client-id': Flags.string({
      description: 'The Client ID of your app. Use with --config to push that configuration for a different app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    url: Flags.string({
      description: 'Public HTTPS origin of your separately hosted backend. Overrides URLs in the dev preview only.',
      env: 'SHOPIFY_FLAG_URL',
      parse: async (input) => {
        const url = safeParseURL(input)
        if (
          !url ||
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash
        ) {
          throw new AbortError(
            'The --url flag must be an HTTPS origin without a path, query, fragment, or credentials.',
          )
        }
        return url.origin
      },
    }),
    'skip-dependencies-installation': Flags.boolean({
      description: 'Skips the installation of dependencies. Deprecated, use workspaces instead.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(DevPush)
    await addPublicMetadata(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
    }))
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
      ensureUserAccess: false,
    })

    try {
      const result = await devPush({
        appContextResult,
        store,
        url: flags.url,
        skipDependenciesInstallation: flags['skip-dependencies-installation'],
      })
      renderDevPushResult(result, flags.json ? 'json' : 'text')
    } catch (error) {
      if (error instanceof AbortSilentError) {
        throw new AbortError('The dev preview push did not complete. See the diagnostics for details.')
      }
      throw error
    }

    return {app: appContextResult.app}
  }
}
