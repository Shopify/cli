import {globalFlags} from '@shopify/cli-kit/node/cli'
import colors from '@shopify/cli-kit/node/colors'

interface CLIConfigOptions {
  verbose?: boolean
  noColor?: boolean
}

/**
 * Emulates the environment setup that oCLI commands perform when executed theme commands are executed programmatically.
 * Source: packages/cli-kit/src/public/node/cli.ts
 *
 * @param options - Configuration options for the CLI environment
 */
export function configureCLIEnvironment(options: CLIConfigOptions): void {
  if (options.verbose) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env[globalFlags.verbose.env!] = 'true'
  }

  if (options.noColor) {
    colors.level = 0
    process.env.FORCE_COLOR = '0'
  }
}
