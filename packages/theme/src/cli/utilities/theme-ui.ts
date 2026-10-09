import {LocalFileChanges} from './theme-downloader.js'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {Task, renderConfirmationPrompt, renderError, renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isInputDisabled} from '@shopify/cli-kit/node/no-input'
import {Writable} from 'stream'

export function themeComponent(theme: Theme) {
  return [
    `'${theme.name}'`,
    {
      subdued: `(#${theme.id})`,
    },
  ]
}

export function themesComponent(themes: Theme[]) {
  const items = themes.map(themeComponent)

  return {list: {items}}
}

export async function ensureDirectoryConfirmed(
  force: boolean,
  message = "It doesn't seem like you're running this command in a theme directory.",
  environment?: string,
  multiEnvironment?: boolean,
) {
  if (force) {
    return true
  }

  if (multiEnvironment) {
    renderError({
      headline: environment ? `Environment: ${environment}` : '',
      body: message,
    })
    return false
  }

  renderWarning({body: message})

  if (isInputDisabled()) {
    throw new AbortError(
      'This command must run from a theme directory when user input is unavailable.',
      'Run the command from a theme directory, or use `--force` to continue.',
    )
  }

  if (!terminalSupportsPrompting()) return true

  const confirm = await renderConfirmationPrompt({
    message: 'Do you want to proceed?',
  })

  recordEvent(`theme-service:confirm-directory:${confirm}`)

  return confirm
}

export async function ensureLiveThemeConfirmed(theme: Theme, action: string, allowLive: boolean) {
  if (theme.role !== LIVE_THEME_ROLE || allowLive) {
    return true
  }

  if (!terminalSupportsPrompting()) {
    throw new AbortError(
      `Can't ${action} on the live theme when user input is unavailable.`,
      'Use `--allow-live` to confirm that you want to continue.',
    )
  }

  const message =
    `You're about to ${action} on your live theme "${theme.name}". ` +
    `This will make changes visible to customers. Are you sure you want to proceed?`

  const confirm = await renderConfirmationPrompt({
    message,
    confirmationMessage: 'Yes, proceed with live theme',
    cancellationMessage: 'No, cancel',
  })

  recordEvent(`theme-service:confirm-live-theme:${confirm}`)

  return confirm
}

const MAX_LISTED_LOCAL_FILES = 10

/**
 * Asks for confirmation before local files are overwritten or deleted. When
 * prompting isn't possible, it warns about the affected files and proceeds.
 */
export async function ensureLocalFileChangesConfirmed(
  changes: LocalFileChanges,
  force: boolean,
  environment?: string,
  multiEnvironment?: boolean,
) {
  const files = [...changes.overwritten, ...changes.deleted]
  if (force || files.length === 0) return true

  const fileCount = (count: number) => (count === 1 ? '1 local file' : `${count} local files`)
  const actions = []
  if (changes.overwritten.length > 0) actions.push(`overwrite ${fileCount(changes.overwritten.length)}`)
  if (changes.deleted.length > 0) actions.push(`delete ${fileCount(changes.deleted.length)}`)

  const unlistedCount = files.length - MAX_LISTED_LOCAL_FILES
  const body = [
    `Pulling this theme will ${actions.join(' and ')}:`,
    {list: {items: files.slice(0, MAX_LISTED_LOCAL_FILES)}},
    ...(unlistedCount > 0 ? [`and ${unlistedCount} more.`] : []),
  ]

  renderWarning({headline: environment ? `Environment: ${environment}` : '', body})

  if (multiEnvironment || !terminalSupportsPrompting()) return true

  const confirm = await renderConfirmationPrompt({
    message: 'Do you want to proceed?',
    confirmationMessage: 'Yes, update my local files',
    cancellationMessage: 'No, cancel',
  })

  recordEvent(`theme-service:confirm-local-file-changes:${confirm}`)

  return confirm
}

// This prevents the progress bar from polluting stdout (important for pipe operations)
export async function renderTasksToStdErr(tasks: Task[], stderr?: Writable, noProgressBar = false) {
  if (tasks.length > 0) {
    await renderTasks(tasks, {renderOptions: {stdout: (stderr ?? process.stderr) as NodeJS.WriteStream}, noProgressBar})
  }
}
