import {List} from './List.js'
import {Controller as AbortController, Signal as AbortSignal} from '../../../../abort.js'
import React, {useEffect, useState} from 'react'
import {Text, useInput, Box} from 'ink'

export interface InteractiveListProps {
  question: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (value: string, signal: AbortSignal) => Promise<any[]>
}

const InteractiveList: React.FC<InteractiveListProps> = (options) => {
  const [input, setInput] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [list, setList] = useState<any[]>([])
  useInput((char, key) => {
    if (key.delete) {
      setInput(input.substring(0, input.length - 1))
    } else {
      setInput(input + char)
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    if (input) {
      options
        .fetch(input, signal)
        .then((results) => {
          setList(results.slice(0, 2).map((result) => result.title))
        })
        // eslint-disable-next-line node/handle-callback-err
        .catch((error) => {
          // noop
        })
    }
    return () => {
      controller.abort()
    }
  }, [input])

  return (
    <Box flexDirection="column">
      <Text>
        {options.question} {input}
      </Text>
      {list && <List items={list} />}
    </Box>
  )
}

export {InteractiveList}
