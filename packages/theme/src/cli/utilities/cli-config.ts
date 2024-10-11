import {globalFlags} from '@shopify/cli-kit/node/cli'

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
    process.env[globalFlags.verbose.env!] = 'true'
  }

  if (options.noColor) {
    process.env[globalFlags['no-color'].env!] = 'true'
  }
}
