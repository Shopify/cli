import Command from '../../../utilities/app-command.js'
import {draftExtensionsPush} from '../../../services/draft-extensions/push.js'
import {DraftExtensionsPushOptions} from '../../../services/context.js'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class DraftExtensionsPush extends Command {
  static description = 'Updates the content of the app draft version.'
  static hidden = true

  static flags = {
    verbose: Flags.boolean({
      hidden: false,
      description: 'Increase the verbosity of the logs.',
      env: 'SHOPIFY_FLAG_VERBOSE',
    }),
    path: Flags.string({
      description: 'The path to your app directory.',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
      env: 'SHOPIFY_FLAG_PATH',
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
    config: Flags.string({
      hidden: false,
      char: 'c',
      description: 'The name of the app configuration.',
      env: 'SHOPIFY_FLAG_APP_CONFIG',
    }),
    'enable-dev-preview': Flags.boolean({
      hidden: false,
      description: 'Enable dev preview after the draft content is updated.',
      env: 'SHOPIFY_FLAG_ENABLE_DEV_PREVIEW',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DraftExtensionsPush)

    const pushDraftExtensionsOptions: DraftExtensionsPushOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
      reset: flags.reset,
      config: flags.config,
      enableDeveloperPreview: flags['enable-dev-preview'],
    }

    await draftExtensionsPush(pushDraftExtensionsOptions)
  }
}
