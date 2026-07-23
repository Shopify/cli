import {homeDirectory, isDevelopment} from './context/local.js'
import {isTruthy} from './context/utilities.js'
import {fileExistsSync} from './fs.js'
import {outputDebug, outputInfo} from './output.js'
import {joinPath} from './path.js'
import {exec, terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {LocalStorage} from './local-storage.js'
import {
  ConfSchema,
  getSkillInstallPromptDismissed,
  setSkillInstallPromptDismissed,
  runAtMinimumInterval,
} from '../../private/node/conf-store.js'

type SkillInstallPromptChoice = 'install' | 'later' | 'never'

/**
 * Options for {@link promptShopifySkillInstallIfNeeded}.
 */
export interface PromptShopifySkillInstallOptions {
  /** The command being run, used to avoid prompting recursively from `skill` commands. */
  currentCommand: string

  /** The arguments of the command being run, used to avoid corrupting `--json` output. */
  args?: string[]

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
 * Asks the user whether to install the Shopify skill for coding agents when it
 * isn't installed yet. Selecting yes runs `shopify skill install` in a detached
 * background process, so the current command is never delayed.
 *
 * The prompt is shown at most once per day, and never again once the skill is
 * detected as installed or the user opts out, so deliberately uninstalling the
 * skill won't trigger new prompts.
 *
 * Skipped for `skill` commands (to avoid recursion), for `--json` output, in
 * non-interactive terminals, in CI, in unit tests, in development mode, and
 * when `SHOPIFY_CLI_NO_SKILL_INSTALL_PROMPT` is set.
 *
 * @param options - See {@link PromptShopifySkillInstallOptions}.
 */
export async function promptShopifySkillInstallIfNeeded(options: PromptShopifySkillInstallOptions): Promise<void> {
  const {currentCommand, args = [], argv = process.argv, env = process.env, config, homeDir} = options

  if (skipSkillInstallPrompt(currentCommand, args, env)) return
  if (getSkillInstallPromptDismissed(config)) return
  if (shopifySkillIsInstalled(env, homeDir)) {
    setSkillInstallPromptDismissed(config)
    return
  }

  const nodeBinary = argv[0]
  const shopifyBinary = argv[1]
  if (!nodeBinary || !shopifyBinary) return

  // Ask at most once per day: the timestamp is recorded when the prompt is shown,
  // so both "ask me tomorrow" and a failed install naturally re-prompt a day later.
  await runAtMinimumInterval(
    'skill-install-prompt',
    {days: 1},
    async () => {
      const choice: SkillInstallPromptChoice = await renderSelectPrompt({
        message:
          'The Shopify skill helps coding agents like Claude Code, Cursor, and Codex build with Shopify. Install it?',
        choices: [
          {label: 'Yes, install it now', value: 'install'},
          {label: 'No, ask me tomorrow', value: 'later'},
          {label: 'No, never ask again', value: 'never'},
        ],
      })

      switch (choice) {
        case 'install':
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
          outputInfo(
            'Installing the Shopify skill in the background. Run `shopify skill install` to reinstall it at any time.',
          )
          break
        case 'later':
          // Nothing to record: the daily interval re-prompts on the first command tomorrow.
          break
        case 'never':
          setSkillInstallPromptDismissed(config)
          break
      }
    },
    config,
  )
}

function skipSkillInstallPrompt(currentCommand: string, args: string[], env: NodeJS.ProcessEnv): boolean {
  return (
    currentCommand.startsWith('skill') ||
    args.includes('--json') ||
    isTruthy(env.SHOPIFY_FLAG_JSON) ||
    isTruthy(env.CI) ||
    isTruthy(env.SHOPIFY_UNIT_TEST) ||
    isTruthy(env.SHOPIFY_CLI_NO_SKILL_INSTALL_PROMPT) ||
    isDevelopment(env) ||
    !terminalSupportsPrompting()
  )
}
