import {LoadingBar} from './LoadingBar.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {isUnitTest} from '../../../../public/node/context/local.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import {useExitOnCtrlC} from '../hooks/use-exit-on-ctrl-c.js'
import {runTasks, Task} from '../tasks.js'

import React, {useState} from 'react'

export type {Task} from '../tasks.js'

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

const noop = () => {}

function Tasks<TContext>({
  tasks,
  silent = isUnitTest(),
  onComplete = noop,
  abortSignal,
  noColor,
  noProgressBar = false,
}: React.PropsWithChildren<TasksProps<TContext>>) {
  const [currentTask, setCurrentTask] = useState<Task<TContext>>(tasks[0]!)
  const [state, setState] = useState<TasksState>(TasksState.Loading)

  useAsyncAndUnmount(async () => onComplete(await runTasks(tasks, setCurrentTask)), {
    onFulfilled: () => {
      setState(TasksState.Success)
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
