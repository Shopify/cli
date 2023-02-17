import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface SubduedProps {
  subdued: string
}

/**
 * `Subdued` displays some text with subdued colors
 */
const Subdued: FunctionComponent<SubduedProps> = ({subdued}): JSX.Element => {
  return <Text dimColor>{subdued}</Text>
}

export {Subdued}
