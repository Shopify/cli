import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {Task, renderConfirmationPrompt, renderError, renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'
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

  if (!process.stdout.isTTY) {
    return true
  }

  const confirm = await renderConfirmationPrompt({
    message: 'Do you want to proceed?',
  })

  recordEvent(`theme-service:confirm-directory:${confirm}`)

  return confirm
}

export async function ensureLiveThemeConfirmed(theme: Theme, action: string) {
  if (theme.role !== LIVE_THEME_ROLE || !process.stdout.isTTY) {
    return true
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

// This prevents the progress bar from polluting stdout (important for pipe operations)
export async function renderTasksToStdErr(tasks: Task[], stderr?: Writable, noProgressBar = false) {
  if (tasks.length > 0) {
    await renderTasks(tasks, {renderOptions: {stdout: (stderr ?? process.stderr) as NodeJS.WriteStream}, noProgressBar})
  }
}
