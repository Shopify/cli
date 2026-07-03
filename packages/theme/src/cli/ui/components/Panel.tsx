import {palette} from '../palette.js'
import {Box, Text, useApp} from '@shopify/cli-kit/node/ink'
import React, {FunctionComponent, useEffect} from 'react'

export interface PanelProps {
  title?: string
  footer?: string
  children?: React.ReactNode
}

const Panel: FunctionComponent<PanelProps> = ({title, footer, children}) => {
  const {exit} = useApp()

  useEffect(() => {
    exit()
  }, [])

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={palette.border}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      {title ? (
        <Text bold color={palette.header}>
          {title}
        </Text>
      ) : null}
      {children}
      {footer ? (
        <Box marginTop={1}>
          <Text color={palette.subdued}>{footer}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

export {Panel}
