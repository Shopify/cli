import {checkScript} from './check.js'
import {fetchStoreThemes} from '../../utilities/theme-selector/fetch.js'
import {Filter, filterThemes} from '../../utilities/theme-selector/filter.js'
import {renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {fetchTheme, upgradeTheme} from '@shopify/cli-kit/node/themes/api'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {sleep} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {codeEditorUrl, themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'

interface Context {
  get theme(): Theme
  set theme(value: Theme)
  get scriptContent(): string | undefined
  set scriptContent(value: string | undefined)
}

interface Options {
  script?: string
  'from-theme': string
  'to-theme': string
}

// 5 minutes
const UPDATER_TIMEOUT = 5 * 60 * 1000

export async function run(session: AdminSession, options: Options) {
  const ctx = await renderTasks<Context>([
    task(`Checking your theme update script`, (ctx) => check(ctx, options)),
    task(`Starting your theme update`, (ctx) => triggerUpdater(ctx, session, options)),
    task(`Updating your theme`, (ctx) => waitForUpdater(ctx, session)),
  ])

  renderSuccess({
    body: 'Your theme has been updated.',
    nextSteps: [
      [
        {
          link: {
            label: 'Explore the updated theme in the code editor',
            url: codeEditorUrl(ctx.theme, session),
          },
        },
      ],
      [
        {
          link: {
            label: 'Explore the updated theme in the theme editor',
            url: themeEditorUrl(ctx.theme, session),
          },
        },
      ],
      [
        {
          link: {
            label: 'Preview the updated theme',
            url: themePreviewUrl(ctx.theme, session),
          },
        },
      ],
    ],
  })
}

async function check(ctx: Context, options: Options) {
  const {script} = options

  if (!script) {
    return
  }

  await sleep(1)
  await checkScript(script)

  ctx.scriptContent = await readFile(joinPath(script))
}

async function triggerUpdater(ctx: Context, session: AdminSession, options: Options) {
  const {'from-theme': fromTheme, 'to-theme': toTheme} = options
  const store = session.storeFqdn

  const themes = await fetchStoreThemes(session)

  const fromThemeId = findThemeByIdentifier(store, themes, fromTheme).id
  const toThemeId = findThemeByIdentifier(store, themes, toTheme).id

  // This is a false positive, as `renderTasks` performs tasks sequentially.
  // eslint-disable-next-line require-atomic-updates
  ctx.theme = await triggerUpgradeAPI(session, ctx.scriptContent, fromThemeId, toThemeId)
}

async function waitForUpdater(ctx: Context, session: AdminSession) {
  const startTime = Date.now()

  /**
   * Generally, it's a good practice to take full advantage of the parallelization
   * benefits of async/await.
   *
   * However, in the context of polling an API, each iteration must wait for the
   * response, before the next polling.
   */
  // eslint-disable-next-line no-await-in-loop
  while (await isUpdaterIsProgress(ctx, session, startTime)) {
    // retry
  }
}

async function isUpdaterIsProgress(ctx: Context, session: AdminSession, startTime: number) {
  const theme = await fetchTheme(ctx.theme.id, session)

  if (!theme) {
    throw new AbortError(
      'The `update_extension.json` script could not be executed due to a runtime issue.',
      'Please check the `update_extension.json` script and retry.',
    )
  }

  const elapsedTime = Date.now() - startTime

  if (theme.processing && elapsedTime >= UPDATER_TIMEOUT) {
    throw new AbortError(
      'The `update_extension.json` script could not be executed due to a timeout issue.',
      'Please check the `update_extension.json` script and retry.',
    )
  }

  // Sleep for 3 seconds before polling again
  await sleep(3)

  return theme.processing
}

/**
 * Trigger the Updater API
 *
 * @param session - current admin session.
 * @param _updateExtension - `update_extension.json` script content.
 * @param fromTheme - The theme ID or name of the theme at the previous version.
 * @param toTheme - The theme ID or name of the theme at the target version.
 *
 * @returns the reference to the updated theme.
 */
async function triggerUpgradeAPI(
  session: AdminSession,
  _updateExtension: string | undefined,
  fromTheme: number,
  toTheme: number,
): Promise<Theme> {
  try {
    const theme = await upgradeTheme({
      fromTheme,
      toTheme,
      script: _updateExtension,
      session,
    })

    if (!theme) {
      throw new AbortError('Updated theme could not be created')
    }

    return theme
  } catch (err) {
    if (!(err instanceof AbortError)) {
      throw err
    }

    throw new AbortError(
      ['The update process could not be triggered.', `Cause: ${err.message}`],
      'Please check the `update_extension.json` script and retry.',
    )
  }
}

function task(title: string, taskFn: (ctx: Context) => Promise<void>) {
  return {title, task: taskFn}
}

function findThemeByIdentifier(store: string, themes: Theme[], theme: string) {
  return filterThemes(store, themes, new Filter({theme})).at(0)!
}
