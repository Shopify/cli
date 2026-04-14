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

/**
 * Checks whether the stream Ink is rendering to supports cursor movement.
 * When it doesn't (piped stdout, dumb terminal, non-TTY CI runner, AI coding
 * agents), every animation frame would be appended as a new line instead of
 * overwriting the previous one.
 *
 * We inspect the stdout object Ink is actually using (via `useStdout`) so the
 * check stays accurate even when a custom stream is provided through
 * `renderOptions` (e.g. `renderTasksToStdErr` passes `process.stderr`).
 *
 * On real Node streams, `isTTY` is only defined as an own property when the
 * stream IS a TTY — it's completely absent otherwise, not set to `false`.
 * So we check the value directly: truthy means TTY, falsy/missing means not.
 */
function useOutputSupportsCursor(stdout: NodeJS.WriteStream | Record<string, unknown>): boolean {
  return Boolean((stdout as Record<string, unknown>).isTTY)
}

const LoadingBar = ({title, noColor, noProgressBar}: React.PropsWithChildren<LoadingBarProps>) => {
  const {twoThirds} = useLayout()
  const {stdout} = useStdout()
  const supportsCursor = useOutputSupportsCursor(stdout)

  let loadingBar = new Array(twoThirds).fill(loadingBarChar).join('')
  if (noColor ?? !shouldDisplayColors()) {
    loadingBar = hillString.repeat(Math.ceil(twoThirds / hillString.length))
  }

  return (
    <Box flexDirection="column">
      {supportsCursor && !noProgressBar && <TextAnimation text={loadingBar} maxWidth={twoThirds} />}
      <Text>{title} ...</Text>
    </Box>
  )
}

export {LoadingBar}
