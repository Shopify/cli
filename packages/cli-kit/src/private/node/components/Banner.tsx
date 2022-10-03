import {Box, Text} from 'ink'
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
    info: 'white',
  }[type]
}

const Banner: React.FC<Props> = ({type, children}) => {
  return (
    <Box width={60} padding={1} borderStyle="round" flexDirection="column" borderColor={typeToColor(type)}>
      <Box marginTop={-2} marginBottom={1}>
        <Text dimColor bold>{` ${type} `}</Text>
      </Box>
      {children}
    </Box>
  )
}

export {Banner}
