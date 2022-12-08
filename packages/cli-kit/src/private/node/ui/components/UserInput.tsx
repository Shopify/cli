import {Text} from 'ink'
import React from 'react'

interface Props {
  userInput: string
}

/**
 * `UserInput` displays some text that represents input from the user.
 * For example an answer to a selection prompt.
 */
const UserInput: React.FC<Props> = ({userInput}: React.PropsWithChildren<Props>): JSX.Element => {
  return <Text color="cyan">{userInput}</Text>
}

export {UserInput}
