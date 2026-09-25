import {emitCommandEvent} from '../../../public/node/command-events.js'
import {randomUUID} from '../../../public/node/crypto.js'
import {TokenizedString, unstyled} from '../../../public/node/output.js'

export interface Task<TContext = unknown> {
  title: string | TokenizedString
  task: (ctx: TContext, task: Task<TContext>) => Promise<void | Task<TContext>[]>
  retry?: number
  retryCount?: number
  errors?: Error[]
  skip?: (ctx: TContext) => boolean
}

export async function runTasks<TContext>(tasks: Task<TContext>[], onTask: (task: Task<TContext>) => void = () => {}) {
  const context = {} as TContext
  const operation = randomUUID()
  let currentTask: Task<TContext> | undefined

  const execute = (task: Task<TContext>) => {
    onTask(task)
    return runTask(task, context, () => {
      emitCommandEvent(
        {type: 'progress', operation, status: currentTask ? 'updated' : 'started', message: taskMessage(task)},
        {alreadyRendered: true},
      )
      currentTask = task
    })
  }

  for (const task of tasks) {
    // eslint-disable-next-line no-await-in-loop
    const subTasks = await execute(task)

    if (Array.isArray(subTasks) && subTasks.length > 0 && subTasks.every((task) => 'task' in task)) {
      for (const subTask of subTasks) {
        // eslint-disable-next-line no-await-in-loop
        await execute(subTask)
      }
    }
  }

  // A task list can grow while it runs, so only the entire list marks the operation complete.
  if (currentTask) {
    emitCommandEvent(
      {type: 'progress', operation, status: 'completed', message: taskMessage(currentTask), current: 1, total: 1},
      {alreadyRendered: true},
    )
  }

  return context
}

async function runTask<TContext>(task: Task<TContext>, context: TContext, onStart: () => void) {
  task.retryCount = 0
  task.errors = []
  const attempts = task.retry && task.retry > 0 ? task.retry + 1 : 1
  let started = false

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (task.skip?.(context)) return

      if (!started) {
        onStart()
        started = true
      }

      // eslint-disable-next-line no-await-in-loop
      return await task.task(context, task)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (attempt === attempts) throw error
      task.errors.push(error)
      task.retryCount = attempt
    }
  }
}

function taskMessage<TContext>(task: Task<TContext>) {
  return unstyled(typeof task.title === 'string' ? task.title : task.title.value)
}
