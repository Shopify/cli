import {Box, Text, useStdout} from 'ink'
import React from 'react'

export type BannerType = 'success' | 'error' | 'warning' | 'info' | 'external_error'

interface Props {
  type: BannerType
}

function typeToColor(type: Props['type']) {
  return {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'dim',
    external_error: 'red',
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

const BoxWithBorder: React.FC<Props> = ({type, children}) => {
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
        <Text dimColor bold>{` ${type.replace(/_/g, ' ')} `}</Text>
      </Box>
      {children}
    </Box>
  )
}

const BoxWithTopLine: React.FC<Props> = ({type, children}) => {
  const {stdout} = useStdout()
  const width = calculateWidth(stdout)

  return (
    <Box marginY={1} flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          <Text color={typeToColor(type)}>{'─'.repeat(2)}</Text>
          <Text dimColor bold>{` ${type.replace(/_/g, ' ')} `}</Text>
          {/* 2 initial dashes + 2 spaces surrounding the type */}
          <Text color={typeToColor(type)}>{'─'.repeat(width - 2 - type.length - 2)}</Text>
        </Text>
      </Box>

      {children}

      <Box marginTop={1}>
        <Text color={typeToColor(type)}>{'─'.repeat(width)}</Text>
      </Box>
    </Box>
  )
}

const BannerBox: React.FC<Props> = ({type, children}) => {
  if (type === 'external_error') {
    return <BoxWithTopLine type={type}>{children}</BoxWithTopLine>
  }

  return <BoxWithBorder type={type}>{children}</BoxWithBorder>
}

const Banner: React.FC<Props> = ({type, children}) => {
  return <BannerBox type={type}>{children}</BannerBox>
}

export {Banner}
