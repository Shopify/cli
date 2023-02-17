import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface FilePathProps {
  filePath: string
}

/**
 * `FilePath` displays a path to a file.
 */
const FilePath: FunctionComponent<FilePathProps> = ({filePath}): JSX.Element => {
  return <Text italic>{filePath}</Text>
}

export {FilePath}
