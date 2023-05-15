import {handleCtrlC} from '../../ui.js'
import {Box, useApp, useInput, useStdout} from 'ink'
import React, {FunctionComponent, useEffect, useRef, useState} from 'react'

interface FullScreenProps {
  closeOnKey: string
}

/**
 * `FullScreen` renders all output in a new buffer and makes it full screen. This is useful when:
 * - You want to preserve terminal history. `ink` [normally clears the terminal history](https://github.com/vadimdemedes/ink/issues/382) if the rendered output is taller than the terminal window. By rendering in a separate buffer history will be preserved and will be visible after pressing `Ctrl+C`.
 * - You want to respond to the resize event of the terminal. Whenever the user resizes their terminal window the output's height and width will be recalculated and re-rendered properly.
 */
const FullScreen: FunctionComponent<FullScreenProps> = ({children, closeOnKey}): JSX.Element => {
  const {stdout} = useStdout()
  const {exit: unmount} = useApp()
  const isFirstRender = useRef(true)

  if (isFirstRender.current) {
    // switch to the alternate buffer
    process.stdout.write('\u001B[?1049h')
    isFirstRender.current = false
  }

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (input === closeOnKey) {
      unmount()
    }
  })

  const [size, setSize] = useState({
    columns: stdout.columns,
    rows: stdout.rows - 1,
  })

  useEffect(() => {
    function onResize() {
      setSize({
        columns: stdout.columns,
        rows: stdout.rows - 1,
      })
    }

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
      // switch back to the main buffer
      stdout.write('\u001B[?1049l')
    }
  }, [stdout])

  return (
    <Box width={size.columns} height={size.rows}>
      {children}
    </Box>
  )
}

export {FullScreen}
