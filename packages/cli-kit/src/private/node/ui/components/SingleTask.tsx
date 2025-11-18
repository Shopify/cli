import {LoadingBar} from './LoadingBar.js'
import {useExitOnCtrlC} from '../hooks/use-exit-on-ctrl-c.js'
import {TokenizedString} from '../../../../public/node/output.js'
import React, {useEffect, useState} from 'react'
import {useApp} from 'ink'

interface SingleTaskProps<T> {
  title: TokenizedString
  task: (updateStatus: (status: TokenizedString) => void) => Promise<T>
  onComplete?: (result: T) => void
  noColor?: boolean
}

const SingleTask = <T,>({task, title, onComplete, noColor}: SingleTaskProps<T>) => {
  const [status, setStatus] = useState(title)
  const [isDone, setIsDone] = useState(false)
  const {exit: unmountInk} = useApp()
  useExitOnCtrlC()

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
