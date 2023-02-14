import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface UserInputProps {
  userInput: string
}

/**
 * `UserInput` displays some text that represents input from the user.
 * For example an answer to a selection prompt.
 */
const UserInput: FunctionComponent<UserInputProps> = ({userInput}): JSX.Element => {
  return <Text color="cyan">{userInput}</Text>
}

export {UserInput}
