import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {Task, renderConfirmationPrompt, renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'

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
) {
  if (force) {
    return true
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

// This prevents the progress bar from polluting stdout (important for pipe operations)
export async function renderTasksToStdErr(tasks: Task[]) {
  if (tasks.length > 0) {
    await renderTasks(tasks, {renderOptions: {stdout: process.stderr}})
  }
}
