import useLayout from '../hooks/use-layout.js'
import {Box, Text} from 'ink'
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

const BoxWithBorder: React.FC<Props> = ({type, children}) => {
  const {twoThirds} = useLayout()

  return (
    <Box
      width={twoThirds}
      paddingY={1}
      paddingX={2}
      marginBottom={1}
      borderStyle="round"
      flexDirection="column"
      borderColor={typeToColor(type)}
    >
      <Box marginTop={-2} marginBottom={1} marginLeft={-1}>
        <Text>{` ${type.replace(/_/g, ' ')} `}</Text>
      </Box>
      {children}
    </Box>
  )
}

const BoxWithTopBottomLines: React.FC<Props> = ({type, children}) => {
  const {twoThirds} = useLayout()

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text>
          <Text color={typeToColor(type)}>{'─'.repeat(2)}</Text>
          <Text>{` ${type.replace(/_/g, ' ')} `}</Text>
          {/* 2 initial dashes + 2 spaces surrounding the type */}
          <Text color={typeToColor(type)}>{'─'.repeat(twoThirds - 2 - type.length - 2)}</Text>
        </Text>
      </Box>

      {children}

      <Box marginTop={1}>
        <Text color={typeToColor(type)}>{'─'.repeat(twoThirds)}</Text>
      </Box>
    </Box>
  )
}

const Banner: React.FC<Props> = ({children, ...props}) => {
  if (props.type === 'external_error') {
    return React.createElement(BoxWithTopBottomLines, props, children)
  } else {
    return React.createElement(BoxWithBorder, props, children)
  }
}

export {Banner}
