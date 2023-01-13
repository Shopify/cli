import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'

// import {environment} from '@shopify/cli-kit'
import {Box, Text} from 'ink'
import React, {useRef, useState} from 'react'

const loadingBarChar = '█'

export interface Task<TContext = unknown> {
  title: string
  task: (ctx: TContext) => Promise<void | Task<TContext>[]>
}

export interface Props<TContext> {
  tasks: Task<TContext>[]
  silent?: boolean
}

function Tasks<TContext>({tasks, silent = false}: React.PropsWithChildren<Props<TContext>>) {
  const {twoThirds} = useLayout()
  const loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  const [currentTask, setCurrentTask] = useState<Task<TContext>>(tasks[0]!)
  const [state, setState] = useState<'success' | 'failure' | 'loading'>('loading')
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

  useAsyncAndUnmount(runTasks, {onFulfilled: () => setState('success'), onRejected: () => setState('failure')})

  if (silent) {
    return null
  }

  return (
    <Box flexDirection="column">
      <Box>
        {state === 'loading' ? (
          <TextAnimation text={loadingBar} />
        ) : (
          <Text color={state === 'success' ? 'green' : 'red'}>{loadingBar}</Text>
        )}
      </Box>
      <Text>
        {state === 'success' ? (
          <Text>Complete!</Text>
        ) : (
          <Text>
            {currentTask.title}
            {state === 'loading' && ' ...'}
          </Text>
        )}
      </Text>
    </Box>
  )
}

export {Tasks}
