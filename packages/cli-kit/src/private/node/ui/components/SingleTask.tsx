import {LoadingBar} from './LoadingBar.js'
import {handleCtrlC, useComplete} from '../../ui.js'
import {TokenizedString} from '../../../../public/node/output.js'
import React, {useEffect, useState} from 'react'

import {useInput, useStdin} from 'ink'

interface SingleTaskProps<T> {
  title: TokenizedString
  task: (updateStatus: (status: TokenizedString) => void) => Promise<T>
  onComplete?: (result: T) => void
  onAbort?: () => void
  noColor?: boolean
}

const SingleTask = <T,>({task, title, onComplete, onAbort, noColor}: SingleTaskProps<T>) => {
  const [status, setStatus] = useState(title)
  const [isDone, setIsDone] = useState(false)
  const [taskResult, setTaskResult] = useState<{error?: Error} | null>(null)
  const complete = useComplete()
  const {isRawModeSupported} = useStdin()

  useInput(
    (input, key) => {
      if (onAbort) {
        handleCtrlC(input, key, onAbort)
      } else {
        handleCtrlC(input, key)
      }
    },
    {isActive: Boolean(isRawModeSupported)},
  )

  useEffect(() => {
    task(setStatus)
      .then((result) => {
        setIsDone(true)
        onComplete?.(result)
        setTaskResult({})
      })
      .catch((error) => {
        setIsDone(true)
        setTaskResult({error})
      })
  }, [task, onComplete])

  useEffect(() => {
    if (taskResult !== null) {
      complete(taskResult.error)
    }
  }, [taskResult, complete])

  if (isDone) {
    // clear things once done
    return null
  }

  return <LoadingBar title={status.value} noColor={noColor} />
}

export {SingleTask}
