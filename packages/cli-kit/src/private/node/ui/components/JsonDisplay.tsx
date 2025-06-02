import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import cjs from 'color-json'

interface JsonDisplayProps {
  data: unknown
}

/**
 * `JsonDisplay` displays JSON data with syntax highlighting.
 */
const JsonDisplay: FunctionComponent<JsonDisplayProps> = ({data}): JSX.Element => {
  try {
    const coloredJson = cjs(data)
    return <Text>{coloredJson}</Text>
  } catch (error) {
    if (error instanceof Error) {
      const fallbackJson = JSON.stringify(data, null, 2)
      return <Text>{fallbackJson}</Text>
    }
    throw error
  }
}

export {JsonDisplay}
