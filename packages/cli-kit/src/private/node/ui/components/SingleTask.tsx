import {LoadingBar} from './LoadingBar.js'
import {useExitOnCtrlC} from '../hooks/use-exit-on-ctrl-c.js'
import React, {useEffect, useState} from 'react'
import {useApp} from 'ink'

interface SingleTaskProps {
  title: string
  taskPromise: Promise<unknown>
  noColor?: boolean
}

const SingleTask = ({taskPromise, title, noColor}: React.PropsWithChildren<SingleTaskProps>) => {
  const [isDone, setIsDone] = useState(false)
  const {exit: unmountInk} = useApp()
  useExitOnCtrlC()

  useEffect(() => {
    taskPromise
      .then(() => {
        setIsDone(true)
        unmountInk()
      })
      .catch((error) => {
        setIsDone(true)
        unmountInk(error)
      })
  }, [taskPromise, unmountInk])

  if (isDone) {
    // clear things once done
    return null
  }

  return <LoadingBar title={title} noColor={noColor} />
}

export {SingleTask}
