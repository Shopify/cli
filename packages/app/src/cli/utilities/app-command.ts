import {configurationFileNames} from '../constants.js'
import Command from '@shopify/cli-kit/node/base-command'
import {path} from '@shopify/cli-kit'

export default abstract class AppCommand extends Command {
  async presetsPath(rawFlags: {path?: string}): Promise<string> {
    const specifiedPath = rawFlags.path ? rawFlags.path : process.cwd()
    const appTOML = await path.findUp(configurationFileNames.app, {
      cwd: specifiedPath,
      type: 'file',
    })
    return appTOML ? path.dirname(appTOML) : specifiedPath
  }

  findUpForPresets(): boolean {
    return false
  }
}
