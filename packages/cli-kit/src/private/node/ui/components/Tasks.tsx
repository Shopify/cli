import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {isUnitTest} from '../../../../public/node/environment/local.js'
import {Box, Text} from 'ink'
import React, {useRef, useState} from 'react'

const loadingBarChar = '▀'

export interface Task<TContext = unknown> {
  title: string
  task: (ctx: TContext) => Promise<void | Task<TContext>[]>
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
      // eslint-disable-next-line no-await-in-loop
      const result = await task.task(ctx.current)
      if (Array.isArray(result) && result.length > 0 && result.every((el) => 'task' in el)) {
        for (const subTask of result) {
          setCurrentTask(subTask)
          // eslint-disable-next-line no-await-in-loop
          await subTask.task(ctx.current)
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
