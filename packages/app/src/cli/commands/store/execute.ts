import {executeStoreScript, ExecuteOptions} from '../../services/store/execute.js'
import {Command, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class StoreExecute extends Command {
  static description = 'Execute a script in the context of a Shopify store'

  static flags = {
    ...globalFlags,
    'script-file': Flags.string({
      description: 'Path to the script file to execute',
      required: true,
      env: 'SHOPIFY_FLAG_SCRIPT_FILE',
    }),
    shop: Flags.string({
      description: 'The shop domain to execute the script against',
      required: true,
      env: 'SHOPIFY_FLAG_SHOP',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreExecute)

    const options: ExecuteOptions = {
      scriptFile: flags['script-file'],
      shop: flags.shop,
    }

    await executeStoreScript(options)
  }
}
