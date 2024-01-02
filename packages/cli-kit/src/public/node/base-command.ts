import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {loadEnvironment} from './environments.js'
import {isDevelopment} from './context/local.js'
import {addPublicMetadata} from './metadata.js'
import {AbortError} from './error.js'
import {renderInfo, renderWarning} from './ui.js'
import {outputContent, outputInfo, outputToken} from './output.js'
import {terminalSupportsRawMode} from './system.js'
import {hashString} from './crypto.js'
import {isTruthy} from './context/utilities.js'
import {JsonMap} from '../../private/common/json.js'
import {underscore} from '../common/string.js'
import {Command, Errors} from '@oclif/core'
import {FlagOutput, Input, ParserOutput, FlagInput, ArgOutput} from '@oclif/core/lib/interfaces/parser.js'

interface EnvironmentFlags {
  environment?: string
  path?: string
}

abstract class BaseCommand extends Command {
  public static analyticsNameOverride(): string | undefined {
    return undefined
  }

  public static analyticsStopCommand(): string | undefined {
    return undefined
  }

  async catch(error: Error & {exitCode?: number | undefined}): Promise<void> {
    await errorHandler(error, this.config)
    return Errors.handle(error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    this.exitWithTimestampWhenEnvVariablePresent()
    if (!isDevelopment()) {
      // This function runs just prior to `run`
      await registerCleanBugsnagErrorsFromWithinPlugins(this.config)
    }
    this.showNpmFlagWarning()
    return super.init()
  }

  // NPM creates an environment variable for every flag passed to a script.
  // This function checks for the presence of any of the available CLI flags
  // and warns the user to use the `--` separator.
  protected showNpmFlagWarning(): void {
    const commandVariables = this.constructor as unknown as {flags: JsonMap}
    const commandFlags = Object.keys(commandVariables.flags || {})
    const possibleNpmEnvVars = commandFlags.map((key) => `npm_config_${underscore(key).replace(/^no_/, '')}`)

    if (possibleNpmEnvVars.some((flag) => process.env[flag] !== undefined)) {
      renderWarning({
        body: [
          'NPM scripts require an extra',
          {command: '--'},
          'separator to pass the flags. Example:',
          {command: 'npm run dev -- --reset'},
        ],
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected exitWithTimestampWhenEnvVariablePresent() {
    if (isTruthy(process.env.SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN)) {
      outputInfo(`
      SHOPIFY_CLI_TIMESTAMP_START
      { "timestamp": ${Date.now()} }
      SHOPIFY_CLI_TIMESTAMP_END
      `)
      process.exit(0)
    }
  }

  protected async parse<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(
    options?: Input<TFlags, TGlobalFlags, TArgs>,
    argv?: string[],
  ): Promise<ParserOutput<TFlags, TGlobalFlags, TArgs> & {argv: string[]}> {
    let result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    result = await this.resultWithEnvironment<TFlags, TGlobalFlags, TArgs>(result, options, argv)
    await addFromParsedFlags(result.flags)
    return {...result, ...{argv: result.argv as string[]}}
  }

  protected environmentsFilename(): string | undefined {
    // To be re-implemented if needed
    return undefined
  }

  protected failMissingNonTTYFlags(flags: FlagOutput, requiredFlags: string[]): void {
    if (terminalSupportsRawMode()) return

    requiredFlags.forEach((name: string) => {
      if (!(name in flags)) {
        throw new AbortError(
          outputContent`Flag not specified:

${outputToken.cyan(name)}

This flag is required in non-interactive terminal environments, such as a CI environment, or when piping input from another process.`,
          'To resolve this, specify the option in the command, or run the command in an interactive environment such as your local terminal.',
        )
      }
    })
  }

  private async resultWithEnvironment<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(
    originalResult: ParserOutput<TFlags, TGlobalFlags, TArgs>,
    options?: Input<TFlags, TGlobalFlags, TArgs>,
    argv?: string[],
  ): Promise<ParserOutput<TFlags, TGlobalFlags, TArgs>> {
    // If no environment is specified, don't modify the results
    const flags = originalResult.flags as EnvironmentFlags
    const environmentsFileName = this.environmentsFilename()
    if (!flags.environment || !environmentsFileName) return originalResult

    // If the specified environment isn't found, don't modify the results
    const environment = await loadEnvironment(flags.environment, environmentsFileName, {from: flags.path})
    if (!environment) return originalResult

    // Parse using noDefaultsOptions to derive a list of flags specified as
    // command-line arguments.
    const noDefaultsResult = await super.parse<TFlags, TGlobalFlags, TArgs>(noDefaultsOptions(options), argv)

    // Add the environment's settings to argv and pass them to `super.parse`. This
    // invokes oclif's validation system without breaking the oclif black box.
    // Replace the original result with this one.
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, [
      // Need to specify argv default because we're merging with argsFromEnvironment.
      ...(argv || this.argv),
      ...argsFromEnvironment<TFlags, TGlobalFlags, TArgs>(environment, options, noDefaultsResult),
    ])

    // Report successful application of the environment.
    reportEnvironmentApplication<TFlags, TGlobalFlags, TArgs>(
      noDefaultsResult.flags,
      result.flags,
      flags.environment,
      environment,
    )

    return result
  }
}

export async function addFromParsedFlags(flags: {path?: string; verbose?: boolean}): Promise<void> {
  await addPublicMetadata(() => ({
    cmd_all_verbose: flags.verbose,
    cmd_all_path_override: flags.path !== undefined,
    cmd_all_path_override_hash: flags.path === undefined ? undefined : hashString(flags.path),
  }))
}

/**
 * Any flag which is:
 *
 * 1. Present in the final set of flags
 * 2. Specified in the environment
 * 3. Not specified by the user as a command line argument
 *
 * should be reported.
 *
 * It doesn't matter if the environment flag's value was the same as the default; from
 * the user's perspective, they want to know their environment was applied.
 */
function reportEnvironmentApplication<
  TFlags extends FlagOutput,
  TGlobalFlags extends FlagOutput,
  TArgs extends ArgOutput,
>(
  noDefaultsFlags: ParserOutput<TFlags, TGlobalFlags, TArgs>['flags'],
  flagsWithEnvironments: ParserOutput<TFlags, TGlobalFlags, TArgs>['flags'],
  environmentName: string,
  environment: JsonMap,
): void {
  const changes: JsonMap = {}
  for (const [name, value] of Object.entries(flagsWithEnvironments)) {
    const userSpecifiedThisFlag = Object.prototype.hasOwnProperty.call(noDefaultsFlags, name)
    const environmentContainsFlag = Object.prototype.hasOwnProperty.call(environment, name)
    if (!userSpecifiedThisFlag && environmentContainsFlag) {
      const valueToReport = name === 'password' ? `********${value.substr(-4)}` : value
      changes[name] = valueToReport
    }
  }
  if (Object.keys(changes).length === 0) return

  const items = Object.entries(changes).map(([name, value]) => `${name}: ${value}`)
  renderInfo({
    headline: ['Using applicable flags from', {userInput: environmentName}, 'environment:'],
    body: [{list: {items}}],
  })
}

/**
 * Strips the defaults from configured flags. For example, if flags contains:
 *
 * ```
 *   someFlag: Flags.boolean({
 *     description: 'some flag',
 *     default: false
 *   })
 * ```
 *
 * it becomes:
 *
 * ```
 *   someFlag: Flags.boolean({
 *     description: 'some flag'
 *   })
 * ```
 *
 * If we parse using this configuration, the only specified flags will be those
 * the user actually passed on the command line.
 */
function noDefaultsOptions<TFlags extends FlagOutput, TGlobalFlags extends FlagOutput, TArgs extends ArgOutput>(
  options: Input<TFlags, TGlobalFlags, TArgs> | undefined,
): Input<TFlags, TGlobalFlags, TArgs> | undefined {
  if (!options?.flags) return options
  return {
    ...options,
    flags: Object.fromEntries(
      Object.entries(options.flags).map(([label, settings]) => {
        const copiedSettings = {...(settings as {default?: unknown})}
        delete copiedSettings.default
        return [label, copiedSettings]
      }),
    ) as FlagInput<TFlags>,
  }
}

/**
 * Converts the environment's settings to arguments as though passed on the command
 * line, skipping any arguments the user specified on the command line.
 */
function argsFromEnvironment<TFlags extends FlagOutput, TGlobalFlags extends FlagOutput, TArgs extends ArgOutput>(
  environment: JsonMap,
  options: Input<TFlags, TGlobalFlags, TArgs> | undefined,
  noDefaultsResult: ParserOutput<TFlags, TArgs>,
): string[] {
  const args: string[] = []
  for (const [label, value] of Object.entries(environment)) {
    const flagIsRelevantToCommand = options?.flags && Object.prototype.hasOwnProperty.call(options.flags, label)
    const userSpecifiedThisFlag =
      noDefaultsResult.flags && Object.prototype.hasOwnProperty.call(noDefaultsResult.flags, label)
    if (flagIsRelevantToCommand && !userSpecifiedThisFlag) {
      if (typeof value === 'boolean') {
        if (value === true) {
          args.push(`--${label}`)
        } else {
          throw new AbortError(
            outputContent`Environments can only specify true for boolean flags. Attempted to set ${outputToken.yellow(
              label,
            )} to false.`,
          )
        }
      } else if (Array.isArray(value)) {
        value.forEach((element) => args.push(`--${label}`, `${element}`))
      } else {
        args.push(`--${label}`, `${value}`)
      }
    }
  }
  return args
}

export default BaseCommand
