import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import Command from '../../../utilities/app-command.js'
import {path, cli, ui, file} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'

const WEBHOOK_TOPICS = {
  'products/create': `Occurs whenever a product is created. Requires the read_products scope.`,
  'products/delete': `Occurs whenever a product publication is deleted. Requires the read_products scope.`,
  'products/update': `Occurs whenever a product is updated, or whenever a product is ordered, or whenever a variant is added, removed, or updated. Requires the read_products scope.`,
}

export default class AppGenerateWebhookHandler extends Command {
  static description = 'Generate a webhook handler'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    topic: Flags.string({
      char: 't',
      hidden: false,
      options: Object.keys(WEBHOOK_TOPICS),
      env: 'SHOPIFY_FLAG_TOPIC',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppGenerateWebhookHandler)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory)
    let options = flags
    if (!options.topic) {
      options = {
        ...options,
        ...(await ui.prompt([
          {
            name: 'topic',
            type: 'select',
            message: 'Which webhook topic will you process?',
            choices: Object.entries(WEBHOOK_TOPICS).map((entry) => {
              return {name: entry[0], value: entry[0]}
            }),
          },
        ])),
      }
    }
    const webhookHandlerPath = path.join(app.webhooksDirectory(), `${options.topic}.js`)
    const code = `import {defineWebhook} from '@shopify/app/webhook'
import {graphqlRequest} from '@shopify/app/api'

export default defineWebhook('${options.topic}', async (payload) => {
    })`
    if (!(await file.exists(path.dirname(webhookHandlerPath)))) {
      await file.mkdir(path.dirname(webhookHandlerPath))
    }
    await file.write(webhookHandlerPath, code)
  }
}
