import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {renderInfo, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {execa} from 'execa'

export default class Demo extends Command {
  static summary = 'Demo command to showcase CLI functionality'

  static description = 'A sample command that demonstrates how to build CLI commands'

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    const currentDir = cwd()
    // const {flags} = await this.parse(Demo)

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

    const defaultOpts = {stdio: 'inherit' as const}

    const template = 'remix'
    const flavor = 'javascript'
    const appName = 'demo-app'
    const appPath = joinPath(currentDir, appName)

    const initArgs = [`--template=${template}`, `--flavor=${flavor}`, `--name=${appName}`, `--path=${appPath}`]
    await execa('shopify', ['app', 'init', ...initArgs], defaultOpts)
  }
}
