import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {JsonMap} from '../../json.js'
import {isDevelopment} from '../../environment/local.js'
import {Abort} from '../../error.js'
import {read as readFile} from '../../file.js'
import {addPublic} from '../../metadata.js'
import {content, info, token} from '../../output.js'
import {findUp} from '../../path.js'
import {hashString} from '../../string.js'
import {decode as decodeTOML} from '../../toml.js'
import {initiateLogging} from '../../log.js'
import {Command, Interfaces} from '@oclif/core'

interface EnvableFlags {
  environment?: string
  path?: string
}

export interface Environments {
  [name: string]: JsonMap
}

abstract class BaseCommand extends Command {
  public static analyticsNameOverride(): string | undefined {
    return undefined
  }

  async catch(error: Error & {exitCode?: number | undefined}) {
    await errorHandler(error, this.config)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    if (!isDevelopment()) {
      // This function runs just prior to `run`
      await registerCleanBugsnagErrorsFromWithinPlugins(this.config)
    }
    await initiateLogging()
    return super.init()
  }

  protected async parse<
    TFlags extends Interfaces.FlagOutput & {path?: string; verbose?: boolean},
    TArgs extends Interfaces.OutputArgs,
  >(
    options?: Interfaces.Input<TFlags> | undefined,
    argv?: string[] | undefined,
  ): Promise<Interfaces.ParserOutput<TFlags, TArgs>> {
    let result = await super.parse<TFlags, TArgs>(options, argv)
    result = await this.resultWithEnvironment<TFlags, TArgs>(options, argv, result)
    await addFromParsedFlags(result.flags)
    return result
  }

  protected async resultWithEnvironment<
    TFlags extends Interfaces.FlagOutput & {path?: string; verbose?: boolean},
    TArgs extends Interfaces.OutputArgs,
  >(
    options: Interfaces.Input<TFlags> | undefined,
    argv: string[] | undefined,
    originalResult: Interfaces.ParserOutput<TFlags, TArgs>,
  ): Promise<Interfaces.ParserOutput<TFlags, TArgs>> {
    // If no environment is specified, don't modify the results
    const flags = originalResult.flags as EnvableFlags
    if (!flags.environment) return originalResult

    // If the specified environment isn't found, don't modify the results
    const environments = await this.environments(flags)
    const environment = environments[flags.environment]
    if (!environment) return originalResult

    // Parse using noDefaultsOptions to derive a list of flags specified as
    // command-line arguments.
    const noDefaultsResult = await super.parse<TFlags, TArgs>(noDefaultsOptions(options), argv)

    // Add the environment's settings to argv and pass them to `super.parse`. This
    // invokes oclif's validation system without breaking the oclif black box.
    // Replace the original result with this one.
    const result = await super.parse<TFlags, TArgs>(options, [
      // Need to specify argv default because we're merging with argsFromEnvironment.
      ...(argv || this.argv),
      ...argsFromEnvironment<TFlags, TArgs>(environment, options, noDefaultsResult),
    ])

    // Report successful application of the environment.
    reportEnvironmentApplication<TFlags, TArgs>(noDefaultsResult.flags, result.flags, flags.environment, environment)

    return result
  }

  // Can be overridden if necessary, intelligent default is specified
  protected async environments(rawFlags: EnvableFlags): Promise<Environments> {
    const projectFileName = this.projectFileName()
    if (!projectFileName) return {}
    const specifiedPath = rawFlags.path ? rawFlags.path : process.cwd()
    const projectTOML = await findUp(projectFileName, {
      cwd: specifiedPath,
      type: 'file',
    })
    if (projectTOML) {
      const decoded = decodeTOML(await readFile(projectTOML)) as {environments: Environments}
      if (typeof decoded.environments === 'object') {
        return decoded.environments
      }
    }
    return {}
  }

  protected projectFileName(): string | undefined {
    return
  }
}

export async function addFromParsedFlags(flags: {path?: string; verbose?: boolean}) {
  await addPublic(() => ({
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
function reportEnvironmentApplication<TFlags extends Interfaces.FlagOutput, TArgs extends Interfaces.OutputArgs>(
  noDefaultsFlags: Interfaces.ParserOutput<TFlags, TArgs>['flags'],
  flagsWithEnvironment: Interfaces.ParserOutput<TFlags, TArgs>['flags'],
  environmentName: string,
  environment: JsonMap,
): void {
  const changes: JsonMap = {}
  for (const [name, value] of Object.entries(flagsWithEnvironment)) {
    const userSpecifiedThisFlag = Object.prototype.hasOwnProperty.call(noDefaultsFlags, name)
    const environmentContainsFlag = Object.prototype.hasOwnProperty.call(environment, name)
    if (!userSpecifiedThisFlag && environmentContainsFlag) changes[name] = value
  }
  if (Object.keys(changes).length === 0) return
  info(content`Using applicable flags from the environment ${token.yellow(environmentName)}:

${Object.entries(changes)
  .map(([name, value]) => `• ${name} = ${value}`)
  .join('\n')}\n`)
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

function noDefaultsOptions<TFlags extends Interfaces.FlagOutput>(
  options: Interfaces.Input<TFlags> | undefined,
): Interfaces.Input<TFlags> | undefined {
  if (!options?.flags) return options
  return {
    ...options,
    flags: Object.fromEntries(
      Object.entries(options.flags).map(([label, settings]) => {
        const copiedSettings = {...(settings as {default?: unknown})}
        delete copiedSettings.default
        return [label, copiedSettings]
      }),
    ) as Interfaces.FlagInput<TFlags>,
  }
}

/**
 * Converts the environment's settings to arguments as though passed on the command
 * line, skipping any arguments the user specified on the command line.
 */
function argsFromEnvironment<TFlags extends Interfaces.FlagOutput, TArgs extends Interfaces.OutputArgs>(
  environment: JsonMap,
  options: Interfaces.Input<TFlags> | undefined,
  noDefaultsResult: Interfaces.ParserOutput<TFlags, TArgs>,
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
          throw new Abort(
            content`Environments can only specify true for boolean flags. Attempted to set ${token.yellow(label)} to false.`,
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
