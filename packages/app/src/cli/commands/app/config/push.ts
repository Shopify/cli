import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {getAppInfo} from '../../../services/local-storage.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {AppSchema} from '../../../models/app/app.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {writeFile} from '@shopify/cli-kit/node/fs'
// eslint-disable-next-line import/no-extraneous-dependencies
import {zodToJsonSchema} from 'zod-to-json-schema'

export default class ConfigPush extends Command {
  static hidden = true

  static description = "Push your app's config to the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
    config: Flags.string({
      hidden: false,
      description: 'Name of the config file.',
      env: 'SHOPIFY_FLAG_APP_CONFIG',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)
    const configName = flags.config || getAppInfo(flags.path)?.configFile
    const app = await loadApp({specifications: [], configName, directory: flags.path, mode: 'report'})

    // being lazy here on how i generate the schemagit checkout
    const jsonSchema = zodToJsonSchema(AppSchema, 'AppSchema')

    await writeFile('./schema.json', JSON.stringify(jsonSchema))
    await pushConfig({app})
  }
}
