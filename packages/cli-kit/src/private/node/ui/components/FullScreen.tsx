import {Box} from 'ink'
import React, {useEffect, useState} from 'react'

/**
 * `FullScreen` renders all output in a new buffer and makes it full screen. This is useful when:
 * - You want to preserve terminal history. `ink` [normally clears the terminal history](https://github.com/vadimdemedes/ink/issues/382) if the rendered output is taller than the terminal window. By rendering in a separate buffer history will be preserved and will be visible after pressing `Ctrl+C`.
 * - You want to respond to the resize event of the terminal. Whenever the user resizes their terminal window the output's height and width will be recalculated and re-rendered properly.
 */
const FullScreen: React.FC = (props: {children?: React.ReactNode}): JSX.Element => {
  const [size, setSize] = useState({
    columns: process.stdout.columns,
    rows: process.stdout.rows,
  })

  useEffect(() => {
    function onResize() {
      setSize({
        columns: process.stdout.columns,
        rows: process.stdout.rows,
      })
    }

    process.stdout.on('resize', onResize)
    // switch to an alternate buffer
    process.stdout.write('\u001B[?1049h')
    return () => {
      process.stdout.off('resize', onResize)
      // switch back to the main buffer
      process.stdout.write('\u001B[?1049l')
    }
  }, [])

  return (
    <Box width={size.columns} height={size.rows}>
      {props.children}
    </Box>
  )
}

export default FullScreen
