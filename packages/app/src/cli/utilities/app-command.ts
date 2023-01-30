import {configurationFileNames} from '../constants.js'
import Command from '@shopify/cli-kit/node/base-command'
import {dirname, cwd} from '@shopify/cli-kit/node/path'
import {findPathUp} from '@shopify/cli-kit/node/fs'

export default abstract class AppCommand extends Command {
  async environmentsPath(rawFlags: {path?: string}): Promise<string> {
    const specifiedPath = rawFlags.path ? rawFlags.path : cwd()
    const appTOML = await findPathUp(configurationFileNames.app, {
      cwd: specifiedPath,
      type: 'file',
    })
    return appTOML ? dirname(appTOML) : specifiedPath
  }

  findUpForEnvironments(): boolean {
    return false
  }
}
