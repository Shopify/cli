import {appFlags} from '../../flags.js'

import {translate} from '../../services/translate.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {getAppConfigurationState} from '../../models/app/loader.js'

import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Translate extends AppCommand {
  static summary = 'Update translations for the app.'

  static usage = `app:translate --force-all`

  static descriptionWithMarkdown = `Translate an app. Retranslate all strings with the \`--re-translate-all\` flag.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    force: Flags.boolean({
      hidden: false,
      description: 'Update translations without asking for confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
    }),
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
      force: flags.force,
    })

    return {app}
  }
}
