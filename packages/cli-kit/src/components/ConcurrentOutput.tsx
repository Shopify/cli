import Process from './Process.js'
import {OutputProcess} from '../output.js'
import React, {FunctionComponent} from 'react'
import {AbortController} from 'abort-controller'
import {Box} from 'ink'

interface Props {
  processes: OutputProcess[]
  abortController: AbortController
}

const ConcurrentOutput: FunctionComponent<Props> = ({processes, abortController}) => {
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green']

  function prefixColor(index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    return concurrentColors[colorIndex]!
  }

  const onError = () => {
    abortController.abort()
  }

  return (
    <Box>
      {processes.map((process, index) => (
        <Process
          process={process}
          key={process.prefix}
          color={prefixColor(index)}
          width={`${Math.floor(100 / processes.length)}%`}
          abortControllerSignal={abortController.signal}
          onError={onError}
        />
      ))}
    </Box>
  )
}

export default ConcurrentOutput
