import Command from '@shopify/cli-kit/node/base-command'

interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Exclude flags that are only for CLI3 but will cause errors if passed to CLI2
  exclude?: string[]
}

export default abstract class ThemeCommand extends Command {
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
