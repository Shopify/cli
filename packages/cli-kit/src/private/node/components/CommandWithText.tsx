import {Text} from 'ink'
import React from 'react'

interface Props {
  text: string
  command: string
}

/**
 * `CommandWithText` displays a command along with some text before it.
 *
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const CommandWithText: React.FC<Props> = ({text, command}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <>
      <Text dimColor>{`${text} `}</Text>
      <Text>{command}</Text>
    </>
  )
}

export {CommandWithText}
