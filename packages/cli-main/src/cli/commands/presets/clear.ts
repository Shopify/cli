import {Flags} from '@oclif/core'
import {output, path} from '@shopify/cli-kit'
import {clearActivePreset, locatePresetsFile} from '@shopify/cli-kit/node/presets'
import Command from '@shopify/cli-kit/node/base-command'

export default class Clear extends Command {
  static description = 'Clear the current active preset'
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
    const directoryContainingPresets = await this.presetsDirectory(directory)
    await clearActivePreset(directoryContainingPresets)
    output.info(output.content`Active preset cleared for directory ${output.token.path(directoryContainingPresets)}`)
  }


  async presetsDirectory(dir: string): Promise<string> {
    const presetsDirectory = await locatePresetsFile(dir, {findUp: true, throwIfNotFound: true})
    return path.dirname(presetsDirectory!)
  }
}
