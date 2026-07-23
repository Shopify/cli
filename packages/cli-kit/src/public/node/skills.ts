import {homeDirectory, isDevelopment} from './context/local.js'
import {isTruthy} from './context/utilities.js'
import {AbortError} from './error.js'
import {fileExistsSync, readFile, writeFile} from './fs.js'
import {fetch} from './http.js'
import {outputDebug, outputInfo} from './output.js'
import {joinPath} from './path.js'
import {exec, terminalSupportsPrompting} from './system.js'
import {renderInfo, renderSelectPrompt} from './ui.js'
import {LocalStorage} from './local-storage.js'
import {
  ConfSchema,
  getSkillInstallPromptDismissed,
  setSkillInstallPromptDismissed,
  runAtMinimumInterval,
} from '../../private/node/conf-store.js'

type SkillInstallPromptChoice = 'install' | 'later' | 'never'

// eslint-disable-next-line no-warning-comments
// TODO: Point at the skill's final hosting URL (or the main branch) before merging. The
// shopify skill only exists on the feature/shopify-validate-command branch until PR #8142 lands.
const SHOPIFY_SKILL_URL =
  'https://raw.githubusercontent.com/Shopify/cli/feature/shopify-validate-command/.agents/skills/shopify/SKILL.md'

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
  return installedShopifySkillPath(env, homeDir) !== undefined
}

function installedShopifySkillPath(env: NodeJS.ProcessEnv, homeDir: string): string | undefined {
  const configHome = env.XDG_CONFIG_HOME ?? joinPath(homeDir, '.config')
  const skillPaths = [
    joinPath(homeDir, '.agents', 'skills', 'shopify', 'SKILL.md'),
    joinPath(configHome, 'agents', 'skills', 'shopify', 'SKILL.md'),
  ]
  return skillPaths.find(fileExistsSync)
}

/**
 * The outcome of a Shopify skill update check.
 */
export type ShopifySkillUpdateResult = 'updated' | 'already-up-to-date' | 'not-installed'

/**
 * Options for {@link updateShopifySkill}.
 */
export interface UpdateShopifySkillOptions {
  /** The process environment. */
  env?: NodeJS.ProcessEnv

  /** The user's home directory, injectable for testing. */
  homeDir?: string
}

/**
 * Updates the installed Shopify skill when its remote source has changed.
 *
 * Fetches the skill source and compares it with the installed universal skill
 * file, writing it over only when the content differs. The installed file is
 * the only state involved, and updating it propagates to every agent through
 * the symlinks created at install time.
 *
 * @param options - See {@link UpdateShopifySkillOptions}.
 * @returns The outcome of the update check.
 */
export async function updateShopifySkill(options: UpdateShopifySkillOptions = {}): Promise<ShopifySkillUpdateResult> {
  const {env = process.env, homeDir = homeDirectory()} = options

  const skillPath = installedShopifySkillPath(env, homeDir)
  if (!skillPath) return 'not-installed'

  // Time-box the request tightly: this check runs before commands, so a slow or
  // broken network must never noticeably delay whatever the user actually asked for.
  const response = await fetch(SHOPIFY_SKILL_URL, undefined, {
    useNetworkLevelRetry: false,
    useAbortSignal: true,
    timeoutMs: 3000,
  })
  if (!response.ok) {
    throw new AbortError(`Failed to check for Shopify skill updates: ${response.status} ${response.statusText}`)
  }

  const remoteContent = await response.text()
  const localContent = await readFile(skillPath)
  if (localContent === remoteContent) return 'already-up-to-date'

  await writeFile(skillPath, remoteContent)
  return 'updated'
}

/**
 * Options for {@link updateShopifySkillIfNeeded}.
 */
export interface UpdateShopifySkillIfNeededOptions {
  /** The command being run, used to avoid updating recursively from `skill` commands. */
  currentCommand: string

  /** The process environment. */
  env?: NodeJS.ProcessEnv

  /** The cli-kit local storage, injectable for testing. */
  config?: LocalStorage<ConfSchema>

  /** The user's home directory, injectable for testing. */
  homeDir?: string
}

/**
 * Keeps an installed Shopify skill up to date, checking the remote source at most
 * once per day. The check runs inline: a tightly time-boxed fetch compares the
 * source with the installed skill, rewrites it when it changed, and announces the
 * update immediately. Failures are logged and retried a day later.
 *
 * Skipped when the skill is not installed (the install prompt owns that case),
 * for `skill` commands (to avoid recursion), in CI, in unit tests, in development
 * mode, and when `SHOPIFY_CLI_NO_SKILL_AUTO_UPDATE` is set.
 *
 * @param options - See {@link UpdateShopifySkillIfNeededOptions}.
 */
export async function updateShopifySkillIfNeeded(options: UpdateShopifySkillIfNeededOptions): Promise<void> {
  const {currentCommand, env = process.env, config, homeDir} = options

  if (skipSkillMaintenance(currentCommand, env)) return
  if (isTruthy(env.SHOPIFY_CLI_NO_SKILL_AUTO_UPDATE)) return
  if (!shopifySkillIsInstalled(env, homeDir)) return

  // Check for skill updates at most once per day.
  await runAtMinimumInterval(
    'skill-update',
    {days: 1},
    async () => {
      try {
        const result = await updateShopifySkill({env, homeDir})
        if (result === 'updated') {
          renderInfo({body: 'The Shopify skill for coding agents was updated to the latest version.'})
        }
        // A skill update must never break the command the user actually ran; failures
        // are logged and naturally retried when the daily interval elapses.
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        outputDebug(`Failed to update the Shopify skill: ${(error as Error).message}`)
      }
    },
    config,
  )
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
    skipSkillMaintenance(currentCommand, env) ||
    args.includes('--json') ||
    isTruthy(env.SHOPIFY_FLAG_JSON) ||
    isTruthy(env.SHOPIFY_CLI_NO_SKILL_INSTALL_PROMPT) ||
    !terminalSupportsPrompting()
  )
}

function skipSkillMaintenance(currentCommand: string, env: NodeJS.ProcessEnv): boolean {
  return currentCommand.startsWith('skill') || isTruthy(env.CI) || isTruthy(env.SHOPIFY_UNIT_TEST) || isDevelopment(env)
}
