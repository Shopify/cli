import {appFlags} from '../../flags.js'
import {info} from '../../services/info.js'
import {appInfoJsonOutputSchema} from '../../services/info/types.js'
import {renderAppInfoResult} from '../../services/info/result.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class AppInfo extends AppLinkedCommand {
  static summary = 'Print basic information about your app and extensions.'

  static descriptionWithMarkdown = `The information returned includes the following:

  - The app and dev store that's used when you run the [dev](https://shopify.dev/docs/api/shopify-cli/app/app-dev) command. You can reset these configurations using [\`dev --reset\`](https://shopify.dev/docs/api/shopify-cli/app/app-dev#flags-propertydetail-reset).
  - The [structure](https://shopify.dev/docs/apps/tools/cli/structure) of your app project.
  - The [access scopes](https://shopify.dev/docs/api/usage) your app has requested.
  - System information, including the package manager and version of Shopify CLI used in the project.`

  static get jsonOutputSchema() {
    return appInfoJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'web-env': Flags.boolean({
      hidden: false,
      description: 'Outputs environment variables necessary for running and deploying web/.',
      env: 'SHOPIFY_FLAG_OUTPUT_WEB_ENV',
      default: false,
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(AppInfo)

    const {app, project, remoteApp, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
      unsafeTolerateErrors: true,
    })
    const result = await info(app, remoteApp, organization, project, {webEnv: flags['web-env']})
    await renderAppInfoResult(result, {app, remoteApp, organization, project}, flags.json ? 'json' : 'text')
    if (!app.errors.isEmpty()) process.exit(2)

    return {app}
  }
}
