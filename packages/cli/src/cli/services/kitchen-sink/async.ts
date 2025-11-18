import {renderConcurrent, renderSingleTask, renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

export async function asyncTasks() {
  // renderConcurrent
  let backendPromiseResolve: () => void

  const backendPromise = new Promise<void>(function (resolve, _reject) {
    backendPromiseResolve = resolve
  })

  const backendProcess = {
    prefix: 'backend',
    action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
      stdout.write('first backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))

      backendPromiseResolve()
    },
  }

  const frontendProcess = {
    prefix: 'frontend',
    action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
      await backendPromise

      stdout.write('first frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third frontend message')
    },
  }

  await renderConcurrent({
    processes: [backendProcess, frontendProcess],
  })

  // renderTasks
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    },
    {
      title: 'Downloading assets',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    },
  ]

  await renderTasks(tasks)

  // renderSingleTask
  await renderSingleTask({
    title: new TokenizedString('Importing data'),
    task: async (updateStatus: (status: TokenizedString) => void) => {
      for (let i = 1; i <= 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500))
        const status = outputContent`Importing data ${outputToken.italic(
          outputContent`(${outputToken.green(i.toString())} complete)`,
        )}`
        updateStatus(status)
      }
      return 'completed'
    },
  })
}
