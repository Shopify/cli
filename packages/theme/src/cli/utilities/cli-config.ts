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
    process.env.DEBUG = process.env.DEBUG ?? '*'
  }

  if (options.noColor) {
    process.env.FORCE_COLOR = '0'
  }
}
