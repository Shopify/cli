import {TextAnimation} from './TextAnimation.js'
import {Box, Text, useApp} from 'ink'
import React, {useEffect, useState} from 'react'

const loadingBar = '██████████████████████████████████████████████████████████'

export interface Task {
  title: string
  task: () => Promise<void>
}

export interface Props {
  tasks: Task[]
}

const Tasks: React.FC<Props> = ({tasks}) => {
  const {exit: unmountInk} = useApp()
  const [currentTask, setCurrentTask] = useState<Task>(tasks[0]!)
  const [state, setState] = useState<'success' | 'failure' | 'loading'>('loading')

  const runTasks = async () => {
    try {
      for (const task of tasks) {
        setCurrentTask(task)
        // eslint-disable-next-line no-await-in-loop
        await task.task()
      }
      setState('success')
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      setState('failure')
    } finally {
      unmountInk()
    }
  }

  useEffect(() => {
    runTasks().catch((error) => {
      unmountInk(error)
    })
  }, [])

  let message: string
  let color: 'greenBright' | 'redBright' | undefined

  if (state === 'success') {
    message = 'Done!'
    color = 'greenBright'
  } else if (state === 'failure') {
    message = `Something went wrong when processing task ${currentTask.title}`
    color = 'redBright'
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
