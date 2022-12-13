import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import {Box, Text, useApp} from 'ink'
import React, {useEffect, useState} from 'react'

const loadingBarChar = '█'

export interface Task {
  title: string
  task: () => Promise<void>
}

export interface Props {
  tasks: Task[]
}

const Tasks: React.FC<Props> = ({tasks}) => {
  const {width} = useLayout()
  const loadingBar = new Array(width).fill(loadingBarChar).join('')
  const {exit: unmountInk} = useApp()
  const [currentTask, setCurrentTask] = useState<Task>(tasks[0]!)
  const [state, setState] = useState<'success' | 'failure' | 'loading'>('loading')

  const runTasks = async () => {
    for (const task of tasks) {
      setCurrentTask(task)
      // eslint-disable-next-line no-await-in-loop
      await task.task()
    }
  }

  useEffect(() => {
    runTasks()
      .then(() => {
        setState('success')
      })
      .catch((error) => {
        setState('failure')
        unmountInk(error)
      })
  }, [])

  let message: string
  let color: 'green' | 'red' | undefined

  if (state === 'success') {
    message = 'Done!'
    color = 'green'
  } else if (state === 'failure') {
    message = currentTask.title
    color = 'red'
  } else {
    message = currentTask.title
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {state === 'loading' ? <TextAnimation>{loadingBar}</TextAnimation> : <Text color={color}>{loadingBar}</Text>}
      <Text>{message}</Text>
    </Box>
  )
}

export default Tasks
