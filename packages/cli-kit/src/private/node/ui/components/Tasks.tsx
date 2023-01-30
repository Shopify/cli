import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {isUnitTest} from '../../../../public/node/environment/local.js'
import {Box, Text} from 'ink'
import React, {useRef, useState} from 'react'

const loadingBarChar = '▀'

export interface Task<TContext = unknown> {
  title: string
  task: (ctx: TContext, task: Task<TContext>) => Promise<void | Task<TContext>[]>
  retry?: number
  retryCount?: number
  errors?: Error[]
  skip?: (ctx: TContext) => boolean
}

export interface Props<TContext> {
  tasks: Task<TContext>[]
  silent?: boolean
}

enum TasksState {
  Loading = 'loading',
  Success = 'success',
  Failure = 'failure',
}

async function runTask<TContext>(task: Task<TContext>, ctx: TContext) {
  task.retryCount = 0
  task.errors = []
  const retry = task?.retry && task?.retry > 0 ? task.retry + 1 : 1

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

function Tasks<TContext>({tasks, silent = isUnitTest()}: React.PropsWithChildren<Props<TContext>>) {
  const {twoThirds} = useLayout()
  const loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
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
    onFulfilled: () => setState(TasksState.Success),
    onRejected: () => setState(TasksState.Failure),
  })

  if (silent) {
    return null
  }

  return state === TasksState.Loading ? (
    <Box flexDirection="column">
      <TextAnimation text={loadingBar} />
      <Text>{currentTask.title} ...</Text>
    </Box>
  ) : null
}

export {Tasks}
