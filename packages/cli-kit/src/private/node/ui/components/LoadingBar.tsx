import {TextAnimation} from './TextAnimation.js'
import useLayout from '../hooks/use-layout.js'
import {shouldDisplayColors} from '../../../../public/node/output.js'
import React from 'react'

import {Box, Text, useStdout} from 'ink'

const loadingBarChar = '▀'
const hillString = '▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁'

interface LoadingBarProps {
  title: string
  noColor?: boolean
  noProgressBar?: boolean
}

const LoadingBar = ({title, noColor, noProgressBar}: React.PropsWithChildren<LoadingBarProps>) => {
  const {twoThirds} = useLayout()
  const {stdout} = useStdout()

  // On real Node streams, isTTY is only present as an own property when the
  // stream IS a TTY.  When Ink's output stream is not a TTY (e.g. AI agents
  // capturing stderr via 2>&1), the animated progress bar can't overwrite
  // previous frames and would flood the output.  Show only the static title
  // in that case.
  const isTTY = Boolean((stdout as unknown as Record<string, unknown>).isTTY)

  let loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  if (noColor ?? !shouldDisplayColors()) {
    loadingBar = hillString.repeat(Math.ceil(twoThirds / hillString.length))
  }

  return (
    <Box flexDirection="column">
      {isTTY && !noProgressBar && <TextAnimation text={loadingBar} maxWidth={twoThirds} />}
      <Text>{title} ...</Text>
    </Box>
  )
}

export {LoadingBar}
