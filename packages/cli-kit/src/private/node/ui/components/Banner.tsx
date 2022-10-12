import {Box, Text, useStdout} from 'ink'
import React from 'react'

export type BannerType = 'success' | 'error' | 'warning' | 'info'

interface Props {
  type: BannerType
}

function typeToColor(type: Props['type']) {
  return {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'dim',
  }[type]
}

const BANNER_MIN_WIDTH = 80

function calculateWidth(stdout: NodeJS.WriteStream | undefined) {
  const fullWidth = stdout?.columns ?? BANNER_MIN_WIDTH
  const twoThirdsOfWidth = Math.floor((fullWidth / 3) * 2)
  let width

  if (fullWidth <= BANNER_MIN_WIDTH) {
    width = fullWidth
  } else if (twoThirdsOfWidth < BANNER_MIN_WIDTH) {
    width = BANNER_MIN_WIDTH
  } else {
    width = twoThirdsOfWidth
  }

  return width
}

const Banner: React.FC<Props> = ({type, children}) => {
  const {stdout} = useStdout()

  return (
    <Box
      width={calculateWidth(stdout)}
      paddingY={1}
      paddingX={2}
      borderStyle="round"
      flexDirection="column"
      borderColor={typeToColor(type)}
    >
      <Box marginTop={-2} marginBottom={1} marginLeft={-1}>
        <Text dimColor bold>{` ${type} `}</Text>
      </Box>
      {children}
    </Box>
  )
}

export {Banner}
