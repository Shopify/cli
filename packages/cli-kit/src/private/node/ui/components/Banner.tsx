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

const Banner: React.FC<Props> = ({type, children}) => {
  const {stdout} = useStdout()

  return (
    <Box
      width={(stdout?.columns ?? 0) >= 80 ? 80 : stdout?.columns}
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
