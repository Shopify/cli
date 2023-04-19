import {demo} from '../services/demo.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {readFile} from '@shopify/cli-kit/node/fs'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

/**
 * This command is used to output all the UI components of the CLI.
 * It's useful to test how they behave under different terminal sizes
 * and to help update the documentation when they change.
 */
export default class Demo extends Command {
  static description = 'Demo a command design defined in a file'
  static hidden = true

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to the design file.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Demo)
    const contents = await readFile(flags.path)
    const design = JSON.parse(contents)
    await demo(design)
  }
}
