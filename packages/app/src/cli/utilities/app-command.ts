import {configurationFileNames} from '../constants.js'
import Command from '@shopify/cli-kit/node/base-command'
import {dirname, findPathUp} from '@shopify/cli-kit/node/path'

export default abstract class AppCommand extends Command {
  async presetsPath(rawFlags: {path?: string}): Promise<string> {
    const specifiedPath = rawFlags.path ? rawFlags.path : process.cwd()
    const appTOML = await findPathUp(configurationFileNames.app, {
      cwd: specifiedPath,
      type: 'file',
    })
    return appTOML ? dirname(appTOML) : specifiedPath
  }

  findUpForPresets(): boolean {
    return false
  }
}
