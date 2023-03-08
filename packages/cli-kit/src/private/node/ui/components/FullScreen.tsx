import {Box, useStdout} from 'ink'
import React, {FunctionComponent, useEffect, useState} from 'react'

/**
 * `FullScreen` renders all output in a new buffer and makes it full screen. This is useful when:
 * - You want to preserve terminal history. `ink` [normally clears the terminal history](https://github.com/vadimdemedes/ink/issues/382) if the rendered output is taller than the terminal window. By rendering in a separate buffer history will be preserved and will be visible after pressing `Ctrl+C`.
 * - You want to respond to the resize event of the terminal. Whenever the user resizes their terminal window the output's height and width will be recalculated and re-rendered properly.
 */
const FullScreen: FunctionComponent = ({children}): JSX.Element => {
  const {stdout} = useStdout()
  const standardOutput = stdout!

  const [size, setSize] = useState({
    columns: standardOutput.columns,
    rows: standardOutput.rows,
  })

  useEffect(() => {
    function onResize() {
      setSize({
        columns: standardOutput.columns,
        rows: standardOutput.rows,
      })
    }

    standardOutput.on('resize', onResize)
    // switch to an alternate buffer
    standardOutput.write('\u001B[?1049h')
    return () => {
      standardOutput.off('resize', onResize)
      // switch back to the main buffer
      standardOutput.write('\u001B[?1049l')
    }
  }, [standardOutput])

  return (
    <Box width={size.columns} height={size.rows}>
      {children}
    </Box>
  )
}

export {FullScreen}
