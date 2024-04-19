import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderWarning, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {WriteStream} from 'tty'

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

export async function currentDirectoryConfirmed(force: boolean) {
  if (force) {
    return true
  }

  renderWarning({body: `It doesn't seem like you're running this command in a theme directory.`})

  if (!process.stdout.isTTY) {
    return true
  }

  return renderConfirmationPrompt({
    message: 'Do you want to proceed?',
  })
}

export class SilentWriteStream extends WriteStream {
  write(): boolean {
    return true
  }
}

export async function silenceableRenderTasks(tasks: Task[], silent?: boolean) {
  if (tasks.length > 0) {
    const renderOptions = silent ? {stdout: new SilentWriteStream(1)} : undefined
    await renderTasks(tasks, {renderOptions})
  }
}
