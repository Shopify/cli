import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface CommandProps {
  command: string
}

/**
 * `Command` displays a command as non-dimmed text.
 */
const Command: FunctionComponent<CommandProps> = ({command}): JSX.Element => {
  return <Text color="magentaBright">`{command}`</Text>
}

export {Command}
