import {Flags} from '@oclif/core'
import {error, output, path} from '@shopify/cli-kit'
import {loadPresetsFromDirectory, locatePresetsFile, activatePreset} from '@shopify/cli-kit/node/presets'
import Command from '@shopify/cli-kit/node/base-command'

export default class Activate extends Command {
  static description = 'Select a configured preset to be active by default'
  static hidden = true

  static args = [
    {
      name: 'preset',
      required: true,
    },
  ]

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Activate)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const directoryContainingPresets = await this.presetsDirectory(directory)
    const loadedPresets = await loadPresetsFromDirectory(directoryContainingPresets)
    const selectedPreset = args.preset
    if (!Object.prototype.hasOwnProperty.call(loadedPresets, selectedPreset)) {
      let message = `Preset ${selectedPreset} not found!`
      if (Object.keys(loadedPresets).length > 0) {
        message += `\n\nTry using a configured preset. Currently these are configured: ${Object.keys(loadedPresets).join(', ')}`
      }
      throw new error.Abort(message)
    }
    activatePreset(selectedPreset, directoryContainingPresets)
    output.info(output.content`Activated preset ${output.token.yellow(selectedPreset)} for directory ${output.token.path(directoryContainingPresets)}`)
  }

  async presetsDirectory(dir: string): Promise<string> {
    const presetsDirectory = await locatePresetsFile(dir, {findUp: true, throwIfNotFound: true})
    return path.dirname(presetsDirectory!)
  }
}
