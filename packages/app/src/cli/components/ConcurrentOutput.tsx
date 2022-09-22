import Process from './Process.js'
import React, {FunctionComponent} from 'react'
import {Box} from 'ink'
import {output} from '@shopify/cli-kit'
import {AbortController} from 'abort-controller'

interface Props {
  processes: output.OutputProcess[]
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
