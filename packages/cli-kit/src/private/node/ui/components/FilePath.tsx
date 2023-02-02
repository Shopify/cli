import {Text} from 'ink'
import React from 'react'

interface Props {
  filePath: string
}

/**
 * `FilePath` displays a path to a file.
 */
const FilePath: React.FC<Props> = ({filePath}: React.PropsWithChildren<Props>): JSX.Element => {
  return <Text>{filePath}</Text>
}

export {FilePath}
