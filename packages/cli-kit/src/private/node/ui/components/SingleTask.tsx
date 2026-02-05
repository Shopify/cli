import {LoadingBar} from './LoadingBar.js'
import {handleCtrlC} from '../../ui.js'
import {TokenizedString} from '../../../../public/node/output.js'
import React, {useEffect, useState} from 'react'

import {useApp, useInput, useStdin} from 'ink'

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
  const {exit: unmountInk} = useApp()
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
        unmountInk()
      })
      .catch((error) => {
        setIsDone(true)
        unmountInk(error)
      })
  }, [task, unmountInk, onComplete])

  if (isDone) {
    // clear things once done
    return null
  }

  return <LoadingBar title={status.value} noColor={noColor} />
}

export {SingleTask}
