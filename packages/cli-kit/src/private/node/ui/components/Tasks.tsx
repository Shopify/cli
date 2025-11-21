import {LoadingBar} from './LoadingBar.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {isUnitTest} from '../../../../public/node/context/local.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import {useExitOnCtrlC} from '../hooks/use-exit-on-ctrl-c.js'
import {TokenizedString} from '../../../../public/node/output.js'
import React, {useRef, useState} from 'react'

export interface Task<TContext = unknown> {
  title: string | TokenizedString
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  task: (ctx: TContext, task: Task<TContext>) => Promise<void | Task<TContext>[]>
  retry?: number
  retryCount?: number
  errors?: Error[]
  skip?: (ctx: TContext) => boolean
}

interface TasksProps<TContext> {
  tasks: Task<TContext>[]
  silent?: boolean
  onComplete?: (ctx: TContext) => void
  abortSignal?: AbortSignal
  noColor?: boolean
  noProgressBar?: boolean
}

enum TasksState {
  Loading = 'loading',
  Success = 'success',
  Failure = 'failure',
}

async function runTask<TContext>(task: Task<TContext>, ctx: TContext) {
  task.retryCount = 0
  task.errors = []
  const retry = task.retry && task.retry > 0 ? task.retry + 1 : 1

  for (let retries = 1; retries <= retry; retries++) {
    try {
      if (task.skip?.(ctx)) {
        return
      }
      // eslint-disable-next-line no-await-in-loop
      return await task.task(ctx, task)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (retries === retry) {
        throw error
      } else {
        task.errors.push(error)
        task.retryCount = retries
      }
    }
  }
}

const noop = () => {}

// eslint-disable-next-line react/function-component-definition
function Tasks<TContext>({
  tasks,
  silent = isUnitTest(),
  onComplete = noop,
  abortSignal,
  noColor,
  noProgressBar = false,
}: React.PropsWithChildren<TasksProps<TContext>>) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [currentTask, setCurrentTask] = useState<Task<TContext>>(tasks[0]!)
  const [state, setState] = useState<TasksState>(TasksState.Loading)
  const ctx = useRef<TContext>({} as TContext)

  const runTasks = async () => {
    for (const task of tasks) {
      setCurrentTask(task)

      // eslint-disable-next-line no-await-in-loop
      const subTasks = await runTask(task, ctx.current)

      // subtasks
      if (Array.isArray(subTasks) && subTasks.length > 0 && subTasks.every((task) => 'task' in task)) {
        for (const subTask of subTasks) {
          setCurrentTask(subTask)
          // eslint-disable-next-line no-await-in-loop
          await runTask(subTask, ctx.current)
        }
      }
    }
  }

  useAsyncAndUnmount(runTasks, {
    onFulfilled: () => {
      setState(TasksState.Success)
      onComplete(ctx.current)
    },
    onRejected: () => {
      setState(TasksState.Failure)
    },
  })

  useExitOnCtrlC()

  const {isAborted} = useAbortSignal(abortSignal)

  if (silent) {
    return null
  }

  const title = typeof currentTask.title === 'string' ? currentTask.title : currentTask.title.value

  return state === TasksState.Loading && !isAborted ? (
    <LoadingBar title={title} noColor={noColor} noProgressBar={noProgressBar} />
  ) : null
}

export {Tasks}
