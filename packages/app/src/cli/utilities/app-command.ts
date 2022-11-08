import {configurationFileNames} from '../constants.js'
import Command, {Environments, EnvableFlags} from '@shopify/cli-kit/node/base-command'
import {file, path, toml} from '@shopify/cli-kit'

export default abstract class AppCommand extends Command {
  override async environments(rawFlags: EnvableFlags): Promise<Environments> {
    const specifiedPath = rawFlags.path ? rawFlags.path : process.cwd()
    const appTOML = await path.findUp(configurationFileNames.app, {
      cwd: specifiedPath,
      type: 'file',
    })
    if (appTOML) {
      const decoded = toml.decode(await file.read(appTOML)) as {environments: Environments}
      if (typeof decoded.environments === 'object') {
        return decoded.environments
      }
    }
    return {}
  }
}
