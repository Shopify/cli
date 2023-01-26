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
}

enum TasksState {
  Loading = 'loading',
  Success = 'success',
  Failure = 'failure',
}

function Tasks<TContext>({tasks}: React.PropsWithChildren<Props<TContext>>) {
  const {twoThirds} = useLayout()
  const loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  const [currentTask, setCurrentTask] = useState<Task<TContext>>(tasks[0]!)
  const [state, setState] = useState<TasksState>(TasksState.Loading)
  const ctx = useRef<TContext>({} as TContext)

  const runTasks = async () => {
    for (const task of tasks) {
      setCurrentTask(task)

      let subTasks

      for (let retries = 1; retries <= (task.retry ?? 1); retries++) {
        try {
          if (task.skip?.(ctx.current)) {
            break
          }
          // eslint-disable-next-line no-await-in-loop
          subTasks = await task.task(ctx.current, task)
          break
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          if (retries === (task.retry ?? 1)) {
            throw error
          } else {
            if (!task.errors) {
              task.errors = []
            }
            task.errors.push(error)
            task.retryCount = retries
          }
        }
      }

      // subtasks
      if (Array.isArray(subTasks) && subTasks.length > 0 && subTasks.every((task) => 'task' in task)) {
        for (const subTask of subTasks) {
          setCurrentTask(subTask)
          for (let retries = 1; retries <= (subTask.retry ?? 1); retries++) {
            try {
              if (subTask.skip?.(ctx.current)) {
                break
              }
              // eslint-disable-next-line no-await-in-loop
              await subTask.task(ctx.current, subTask)
              break
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
              if (retries === (subTask.retry ?? 1)) {
                throw error
              } else {
                if (!subTask.errors) {
                  subTask.errors = []
                }
                subTask.errors.push(error)
                subTask.retryCount = retries
              }
            }
          }
        }
      }
    }
  }

  useAsyncAndUnmount(runTasks, {
    onFulfilled: () => setState(TasksState.Success),
    onRejected: () => setState(TasksState.Failure),
  })

  if (isUnitTest()) {
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
