import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import useAsync from '../hooks/use-async.js'
import {Box, Text} from 'ink'
import React, {useState} from 'react'

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
  const [currentTask, setCurrentTask] = useState<Task>(tasks[0]!)
  const [state, setState] = useState<'success' | 'failure' | 'loading'>('loading')

  const runTasks = async () => {
    for (const task of tasks) {
      setCurrentTask(task)
      // eslint-disable-next-line no-await-in-loop
      await task.task()
    }
  }

  useAsync(runTasks, {onResolve: () => setState('success'), onReject: () => setState('failure')})

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

export default Tasks
