import {Flags} from '@oclif/core'
import {error, output, path} from '@shopify/cli-kit'
import {clearActivePreset} from '@shopify/cli-kit/node/presets'
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
    await clearActivePreset(await this.presetDirectory(directory))
    output.info('Active preset cleared.')
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
