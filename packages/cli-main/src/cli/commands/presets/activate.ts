import {Flags} from '@oclif/core'
import {error, output, path} from '@shopify/cli-kit'
import {loadPresetsFromDirectory, activatePreset} from '@shopify/cli-kit/node/presets'
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
    const directoryContainingPreset = await this.presetDirectory(directory)
    const loadedPresets = await loadPresetsFromDirectory(directoryContainingPreset)
    const selectedPreset = args.preset
    if (!Object.prototype.hasOwnProperty.call(loadedPresets, selectedPreset)) {
      let message = `Preset ${selectedPreset} not found!`
      if (Object.keys(loadedPresets).length > 0) {
        message += `\n\nTry using a configured preset. Currently these are configured: ${Object.keys(loadedPresets).join(', ')}`
      }
      throw new error.Abort(message)
    }
    activatePreset(selectedPreset, directoryContainingPreset)
    output.info(output.content`Activated preset ${output.token.yellow(selectedPreset)} for directory ${output.token.path(directoryContainingPreset)}`)
  }

  async presetDirectory(dir: string): Promise<string> {
    const presetsFilename = 'shopify.presets.toml'
    const presetDirectory = await path.findUp(presetsFilename, {type: 'file', cwd: dir})
    if (!presetDirectory) {
      throw new error.Abort(`No presets file found for ${output.token.path(dir)}

Try running in a directory with a configured ${output.token.path(presetsFilename)} file.`)
    }
    return path.dirname(presetDirectory)
  }
}
