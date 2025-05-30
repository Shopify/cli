import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface DebugMessageProps {
  message: string
}

/**
 * `DebugMessage` displays debug messages in a subdued, dimmed format.
 */
const DebugMessage: FunctionComponent<DebugMessageProps> = ({message}): JSX.Element => {
  return <Text dimColor>[DEBUG] {message}</Text>
}

export {DebugMessage}
