import {TextAnimation} from './TextAnimation.js'
import {Token, TokenItem, TokenizedText} from './TokenizedText.js'
import useLayout from '../hooks/use-layout.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import figures from '../../../../public/node/figures.js'
import {isUnitTest} from '../../../../public/node/context/local.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import {handleCtrlC} from '../../ui.js'
import {Box, Text, useStdin, useInput} from 'ink'
import React, {useRef, useState} from 'react'

const loadingBarChar = '▀'

export interface Task<TContext = unknown> {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  task: (ctx: TContext, task: Task<TContext>, updateFooter: (content: TokenItem | undefined) => void) => Promise<void | Task<TContext>[]>
  retry?: number
  retryCount?: number
  errors?: Error[]
  skip?: (ctx: TContext) => boolean
}

export interface TasksProps<TContext> {
  tasks: Task<TContext>[]
  silent?: boolean
  onComplete?: (ctx: TContext) => void
  abortSignal?: AbortSignal
}

enum TasksState {
  Loading = 'loading',
  Success = 'success',
  Failure = 'failure',
}

async function runTask<TContext>(task: Task<TContext>, ctx: TContext, updateFooter: (content: TokenItem | undefined) => void) {
  task.retryCount = 0
  task.errors = []
  const retry = task.retry && task.retry > 0 ? task.retry + 1 : 1

  for (let retries = 1; retries <= retry; retries++) {
    try {
      if (task.skip?.(ctx)) {
        return
      }
      // eslint-disable-next-line no-await-in-loop
      return await task.task(ctx, task, updateFooter)
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
}: React.PropsWithChildren<TasksProps<TContext>>) {
  const {twoThirds} = useLayout()
  const loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [currentTask, setCurrentTask] = useState<Task<TContext>>(tasks[0]!)
  const [currentFooter, setCurrentFooter] = useState<TokenItem | undefined>(undefined)
  const [state, setState] = useState<TasksState>(TasksState.Loading)
  const ctx = useRef<TContext>({} as TContext)
  const {isRawModeSupported} = useStdin()

  const runTasks = async () => {
    for (const task of tasks) {
      setCurrentTask(task)

      // eslint-disable-next-line no-await-in-loop
      const subTasks = await runTask(task, ctx.current, setCurrentFooter)

      // subtasks
      if (Array.isArray(subTasks) && subTasks.length > 0 && subTasks.every((task) => 'task' in task)) {
        for (const subTask of subTasks) {
          setCurrentTask(subTask)
          // eslint-disable-next-line no-await-in-loop
          await runTask(subTask, ctx.current, setCurrentFooter)
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

  useInput(
    (input, key) => {
      handleCtrlC(input, key)

      if (key.return) {
        return null
      }
    },
    {isActive: Boolean(isRawModeSupported)},
  )

  const {isAborted} = useAbortSignal(abortSignal)

  if (silent) {
    return null
  }

  let arrayifiedFooter: Token[] = []
  if (Array.isArray(currentFooter)) {
    arrayifiedFooter = [figures.arrowRight, ...currentFooter]
  } else if (currentFooter) {
    arrayifiedFooter = [figures.arrowRight, currentFooter]
  }

  return state === TasksState.Loading && !isAborted ? (
    <Box flexDirection="column">
      <TextAnimation text={loadingBar} />
      <Text>{currentTask.title} ...</Text>
      {arrayifiedFooter.length > 0
        ? <TokenizedText item={arrayifiedFooter} />
        : undefined
      }
    </Box>
  ) : null
}

export {Tasks}
