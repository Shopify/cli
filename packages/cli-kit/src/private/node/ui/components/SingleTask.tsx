import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import {shouldDisplayColors} from '../../../../public/node/output.js'
import {handleCtrlC} from '../../ui.js'
import {Box, Text, useStdin, useInput} from 'ink'
import React, {useEffect, useState} from 'react'

const loadingBarChar = '▀'
const hillString = '▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁'

interface SingleTaskProps<T> {
  title: string
  taskFn: () => Promise<T>
  onComplete: (result: T) => void
  noColor?: boolean
}

// eslint-disable-next-line react/function-component-definition
function SingleTask<T>({taskFn, onComplete, title, noColor}: React.PropsWithChildren<SingleTaskProps<T>>) {
  const [isDone, setIsDone] = useState(false)
  const {twoThirds} = useLayout()
  let loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  if (noColor ?? !shouldDisplayColors()) {
    loadingBar = hillString.repeat(Math.ceil(twoThirds / hillString.length))
  }

  const {isRawModeSupported} = useStdin()

  useInput(
    (input, key) => {
      handleCtrlC(input, key)

      if (key.return) {
        return null
      }
    },
    {isActive: Boolean(isRawModeSupported)},
  )

  useEffect(() => {
    taskFn()
      .then(onComplete)
      .then(() => setIsDone(true))
      .catch(() => setIsDone(true))
  }, [taskFn, onComplete])

  if (isDone) {
    return null
  }

  return (
    <Box flexDirection="column">
      <TextAnimation text={loadingBar} maxWidth={twoThirds} />
      <Text>{title} ...</Text>
    </Box>
  )
}

export {SingleTask}
