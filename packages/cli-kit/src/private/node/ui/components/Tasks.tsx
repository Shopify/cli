import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {isUnitTest} from '../../../../public/node/context/local.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {shouldDisplayColors} from '../../../../public/node/output.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import {handleCtrlC} from '../../ui.js'
import {Box, Text, useStdin, useInput} from 'ink'
import React, {useRef, useState} from 'react'

const loadingBarChar = '▀'
const hillString = '▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁'

type UpdateTitle = (title: string) => void

export interface Task<TContext = unknown> {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  task: (ctx: TContext, task: Task<TContext>, updateTitle: UpdateTitle) => Promise<void | Task<TContext>[]>
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
}

enum TasksState {
  Loading = 'loading',
  Success = 'success',
  Failure = 'failure',
}

async function runTask<TContext>(task: Task<TContext>, ctx: TContext, updateTitle: UpdateTitle) {
  task.retryCount = 0
  task.errors = []
  const retry = task.retry && task.retry > 0 ? task.retry + 1 : 1

  for (let retries = 1; retries <= retry; retries++) {
    try {
      if (task.skip?.(ctx)) {
        return
      }
      // eslint-disable-next-line no-await-in-loop
      return await task.task(ctx, task, updateTitle)
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
}: React.PropsWithChildren<TasksProps<TContext>>) {
  const {twoThirds} = useLayout()
  let loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  if (noColor ?? !shouldDisplayColors()) {
    loadingBar = hillString.repeat(Math.ceil(twoThirds / hillString.length))
  }
  const [title, setTitle] = useState<string>(tasks[0]?.title ?? '')
  const [state, setState] = useState<TasksState>(TasksState.Loading)
  const ctx = useRef<TContext>({} as TContext)
  const {isRawModeSupported} = useStdin()

  const runTasks = async () => {
    for (const task of tasks) {
      setTitle(task.title)

      // eslint-disable-next-line no-await-in-loop
      const subTasks = await runTask(task, ctx.current, setTitle)

      // subtasks
      if (Array.isArray(subTasks) && subTasks.length > 0 && subTasks.every((task) => 'task' in task)) {
        for (const subTask of subTasks) {
          setTitle(subTask.title)
          // eslint-disable-next-line no-await-in-loop
          await runTask(subTask, ctx.current, setTitle)
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

  return state === TasksState.Loading && !isAborted ? (
    <Box flexDirection="column">
      <TextAnimation text={loadingBar} maxWidth={twoThirds} />
      <Text>{title} ...</Text>
    </Box>
  ) : null
}

export {Tasks}
