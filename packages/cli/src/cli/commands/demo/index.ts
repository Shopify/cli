import {demo} from '../../services/demo.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {readFile} from '@shopify/cli-kit/node/fs'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Demo extends Command {
  static description = 'Demo a command design defined in a file'
  static hidden = true

  static flags = {
    file: Flags.string({
      hidden: false,
      description: 'The path to the design file.',
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
