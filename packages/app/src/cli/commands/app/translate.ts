import {appFlags} from '../../flags.js'

import {translate} from '../../services/translate.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {getAppConfigurationState} from '../../models/app/loader.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Translate extends AppCommand {
  static summary = 'Translate an app.'

  static usage = `app:translate --someflag <value>`

  static descriptionWithMarkdown = `Translate an app version. Do a thing using the \`--someflag\` flag.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    // 'api-key': Flags.string({
    //   hidden: true,
    //   description: 'The API key of your app.',
    //   env: 'SHOPIFY_FLAG_APP_API_KEY',
    //   exclusive: ['config'],
    // }),
    // force: Flags.boolean({
    //   hidden: false,
    //   description: 'Release without asking for confirmation.',
    //   env: 'SHOPIFY_FLAG_FORCE',
    //   char: 'f',
    // }),
    // version: Flags.string({
    //   hidden: false,
    //   description: 'The name of the app version to release.',
    //   env: 'SHOPIFY_FLAG_VERSION',
    //   required: true,
    // }),
  }

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Translate)
    // if (flags['api-key']) {
    //   await showApiKeyDeprecationWarning()
    // }

    //  // ?? flags['api-key']
    const apiKey = flags['client-id']

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const requiredNonTTYFlags = ['force']
    const configurationState = await getAppConfigurationState(flags.path, flags.config)
    if (configurationState.state === 'template-only' && !apiKey) {
      requiredNonTTYFlags.push('client-id')
    }
    this.failMissingNonTTYFlags(flags, requiredNonTTYFlags)

    const {app, remoteApp, developerPlatformClient} = await linkedAppContext({
      directory: flags.path,
      clientId: apiKey,
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await translate({
      app,
      remoteApp,
      developerPlatformClient,
      //   force: flags.force,
      //   version: flags.version,
    })

    return {app}
  }
}
