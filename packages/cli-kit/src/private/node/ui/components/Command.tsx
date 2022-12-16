import {Text} from 'ink'
import React from 'react'

interface Props {
  command: string
}

/**
 * `Command` displays a command as non-dimmed text.
 */
const Command: React.FC<Props> = ({command}): JSX.Element => {
  return <Text>`{command}`</Text>
}

export {Command}
