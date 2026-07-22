import {homeDirectory, isDevelopment} from './context/local.js'
import {isTruthy} from './context/utilities.js'
import {fileExistsSync} from './fs.js'
import {outputDebug} from './output.js'
import {joinPath} from './path.js'
import {exec} from './system.js'
import {LocalStorage} from './local-storage.js'
import {
  ConfSchema,
  getSkillAutoInstallCompleted,
  setSkillAutoInstallCompleted,
  runAtMinimumInterval,
} from '../../private/node/conf-store.js'

/**
 * Options for {@link installShopifySkillInBackground}.
 */
export interface InstallShopifySkillInBackgroundOptions {
  /** The command being run, used to avoid recursive installs from `skill` commands. */
  currentCommand: string

  /** The process argv, used to re-invoke the current CLI binary. */
  argv?: string[]

  /** The process environment. */
  env?: NodeJS.ProcessEnv

  /** The cli-kit local storage, injectable for testing. */
  config?: LocalStorage<ConfSchema>

  /** The user's home directory, injectable for testing. */
  homeDir?: string
}

/**
 * Checks whether the Shopify skill for coding agents is installed globally.
 *
 * The skills CLI installs universal skills under `~/.agents/skills` (older versions)
 * or `$XDG_CONFIG_HOME/agents/skills` (newer versions), so both locations are checked.
 *
 * @param env - The process environment.
 * @param homeDir - The user's home directory.
 * @returns Whether the Shopify skill is installed in any known global location.
 */
export function shopifySkillIsInstalled(env: NodeJS.ProcessEnv = process.env, homeDir = homeDirectory()): boolean {
  const configHome = env.XDG_CONFIG_HOME ?? joinPath(homeDir, '.config')
  const skillDirectories = [
    joinPath(homeDir, '.agents', 'skills', 'shopify'),
    joinPath(configHome, 'agents', 'skills', 'shopify'),
  ]
  return skillDirectories.some(fileExistsSync)
}

/**
 * Installs the Shopify skill for coding agents by running `shopify skill install`
 * in a detached background process, so the current command is never delayed.
 *
 * The install is attempted at most once per day until it succeeds. Once the skill
 * is detected as installed, a completion flag is recorded and the check becomes a
 * no-op forever, so deliberately uninstalling the skill won't trigger a re-install.
 *
 * Skipped for `skill` commands (to avoid recursion), in CI, in unit tests, in
 * development mode, and when `SHOPIFY_CLI_NO_SKILL_AUTO_INSTALL` is set.
 *
 * @param options - See {@link InstallShopifySkillInBackgroundOptions}.
 */
export async function installShopifySkillInBackground(options: InstallShopifySkillInBackgroundOptions): Promise<void> {
  const {currentCommand, argv = process.argv, env = process.env, config, homeDir} = options

  if (skipSkillAutoInstall(currentCommand, env)) return
  if (getSkillAutoInstallCompleted(config)) return
  if (shopifySkillIsInstalled(env, homeDir)) {
    setSkillAutoInstallCompleted(config)
    return
  }

  const nodeBinary = argv[0]
  const shopifyBinary = argv[1]
  if (!nodeBinary || !shopifyBinary) return

  // Retry at most once per day until the skill install succeeds. The timestamp is
  // recorded when the background process is spawned, not when it finishes, so a
  // failed install is retried on the first command run a day later.
  await runAtMinimumInterval(
    'skill-auto-install',
    {days: 1},
    async () => {
      // Run the Shopify command the same way as the current execution, detached
      // from the current process so the CLI can exit before the install finishes.
      // eslint-disable-next-line no-void
      void exec(nodeBinary, [shopifyBinary, 'skill', 'install'], {
        background: true,
        env: {...env, SHOPIFY_CLI_NO_ANALYTICS: '1'},
        externalErrorHandler: async (error: unknown) => {
          outputDebug(`Failed to install the Shopify skill in background: ${(error as Error).message}`)
        },
      })
    },
    config,
  )
}

function skipSkillAutoInstall(currentCommand: string, env: NodeJS.ProcessEnv): boolean {
  return (
    currentCommand.startsWith('skill') ||
    isTruthy(env.CI) ||
    isTruthy(env.SHOPIFY_UNIT_TEST) ||
    isTruthy(env.SHOPIFY_CLI_NO_SKILL_AUTO_INSTALL) ||
    isDevelopment(env)
  )
}
