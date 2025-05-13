import {renderConcurrent, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
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
  interface TaskContext {
    startTime: number
    duration: string
  }
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async (context: TaskContext) => {
        context.startTime = Date.now()
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    },
    {
      title: 'Downloading assets',
      task: async (context: TaskContext, _task: Task<TaskContext>, updateTitle: (title: string) => void) => {
        updateTitle('Downloading assets (1/3)')
        await new Promise((resolve) => setTimeout(resolve, 600))

        updateTitle('Downloading assets (2/3)')
        await new Promise((resolve) => setTimeout(resolve, 600))

        updateTitle('Downloading assets (3/3)')
        await new Promise((resolve) => setTimeout(resolve, 600))

        context.duration = ((Date.now() - context.startTime) / 1000).toFixed(2)
      },
    },
  ]

  await renderTasks(tasks)
}
