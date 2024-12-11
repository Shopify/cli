import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AppInitCommand} from '@shopify/app'
import {renderInfo, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export default class Demo extends Command {
  static summary = 'Demo command to showcase CLI functionality'

  static description = 'Demo command that creates a new Shopify app'

  static flags = {
    ...globalFlags,
    name: Flags.string({
      char: 'n',
      description: 'App name',
      env: 'SHOPIFY_FLAG_NAME',
    }),
  }

  async run(): Promise<void> {
    renderInfo({
      headline: 'Lets learn how to create and deploy a Shopify app!',
      body: `This is a demo command that demonstrates how to use the CLI commands to create and deploy a Shopify app.`,
    })

    await renderTextPrompt({
      message: 'Run the `shopify app init` command to get started:',
      // defaultValue: 'expansive commerce app',
      validate: (value) => {
        if (value !== 'shopify app init') return 'Thats not the `shopify app init` command!'
      },
    })

    await renderSelectPrompt({
      choices: [
        {label: 'Remix', value: 'remix'},
        {label: 'Next.js', value: 'next'},
        {label: 'Svelte', value: 'svelte'},
      ],
      message: 'Get started building your app:',
      validate: (value) => {
        if (value !== 'remix') return 'Thats not the `remix` template!'
      },
    })

    await AppInitCommand.run()
  }
}
