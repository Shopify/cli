import {demo} from '../../services/demo.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {readFile} from '@shopify/cli-kit/node/fs'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Demo extends Command {
  static description = 'Demo a command design defined in a file'
  static hidden = true

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The directory where the demo file is located. Defaults to the current directory.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
    file: Flags.string({
      hidden: false,
      description: 'The name of the demo file.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Demo)
    const contents = await readFile(flags.file)
    const design = JSON.parse(contents)
    await demo(design)
  }
}
