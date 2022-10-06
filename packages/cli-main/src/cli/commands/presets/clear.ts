import {Flags} from '@oclif/core'
import {output, path} from '@shopify/cli-kit'
import {clearActivePreset, locatePresetsFile} from '@shopify/cli-kit/node/presets'
import Command from '@shopify/cli-kit/node/base-command'

export default class Clear extends Command {
  static description = 'Clears the current active preset'
  static hidden = true

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Clear)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    await clearActivePreset(await this.presetsDirectory(directory))
    output.info('Active preset cleared.')
  }


  async presetsDirectory(dir: string): Promise<string> {
    const presetsDirectory = await locatePresetsFile(dir, {findUp: true, throwIfNotFound: true})
    return path.dirname(presetsDirectory!)
  }
}
