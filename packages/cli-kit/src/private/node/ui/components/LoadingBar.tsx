import {LoadingIndicator} from './LoadingIndicator.js'
import {shouldDisplayColors} from '../../../../public/node/output.js'
import React from 'react'

import {Text, useStdout} from 'ink'

interface LoadingBarProps {
  title: string
  noColor?: boolean
  noProgressBar?: boolean
}

const LoadingBar = ({title, noColor, noProgressBar}: React.PropsWithChildren<LoadingBarProps>) => {
  const {stdout} = useStdout()

  // On real Node streams, isTTY is only present as an own property when the
  // stream IS a TTY.  When Ink's output stream is not a TTY (e.g. AI agents
  // capturing stderr via 2>&1), the animated loading indicator can't overwrite
  // previous frames and would flood the output.  Show only the static title
  // in that case.
  const isTTY = Boolean((stdout as unknown as Record<string, unknown>).isTTY)
  const colorsDisabled = noColor ?? !shouldDisplayColors()

  if (!isTTY || noProgressBar) {
    return <Text>{title} ...</Text>
  }

  return <LoadingIndicator title={title} noColor={colorsDisabled} />
}

export {LoadingBar}
