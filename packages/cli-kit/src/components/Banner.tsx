import {Box, Text} from 'ink'
import React from 'react'

interface Props {
  type: 'success' | 'error' | 'warning' | 'info'
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
    <Box width={30} padding={1} borderStyle="round" flexDirection="column" borderColor={typeToColor(type)}>
      <Box marginTop={-2} marginBottom={1}>
        <Text>{` ${type} `}</Text>
      </Box>
      {children}
    </Box>
  )
}

export {Banner}
