import Command, {Environments, EnvableFlags} from '@shopify/cli-kit/node/base-command'
import {file, path, toml} from '@shopify/cli-kit'

interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Exclude flags that are only for CLI3 but will cause errors if passed to CLI2
  exclude?: string[]
}

export default abstract class ThemeCommand extends Command {
  override async environments(rawFlags: EnvableFlags): Promise<Environments> {
    const specifiedPath = rawFlags.path ? rawFlags.path : process.cwd()
    const themeTOML = await path.findUp('shopify.theme.toml', {
      cwd: specifiedPath,
      type: 'file',
    })
    if (themeTOML) {
      const decoded = toml.decode(await file.read(themeTOML)) as {environments: Environments}
      if (typeof decoded.environments === 'object') {
        return decoded.environments
      }
    }
    return {}
  }

  passThroughFlags(flags: FlagValues, {exclude}: PassThroughFlagsOptions): string[] {
    const passThroughFlags: string[] = []
    for (const [label, value] of Object.entries(flags)) {
      if ((exclude ?? []).includes(label)) {
        continue
      } else if (typeof value === 'boolean') {
        if (value) passThroughFlags.push(`--${label}`)
      } else if (Array.isArray(value)) {
        value.forEach((element) => passThroughFlags.push(`--${label}`, `${element}`))
      } else {
        passThroughFlags.push(`--${label}`, `${value}`)
      }
    }
    return passThroughFlags
  }
}
