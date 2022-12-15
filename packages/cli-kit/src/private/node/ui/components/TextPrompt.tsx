import {TextInput} from './TextInput.js'
import {handleCtrlC} from '../../ui.js'
import React, {useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import {figures} from 'listr2'

export interface Props {
  message: string
  onSubmit: (text: string) => void
  placeholder?: string
}

const TextPrompt: React.FC<Props> = ({message, onSubmit, placeholder}) => {
  const [answer, setAnswer] = useState<string>('')
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return && answer.length > 0) {
          setSubmitted(true)
          onSubmit(answer)
          unmountInk()
        }
      },
      [answer, onSubmit],
    ),
  )

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
      </Box>
      {submitted ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer}</Text>
        </Box>
      ) : (
        <TextInput value={answer} onChange={setAnswer} placeholder={placeholder} />
      )}
    </Box>
  )
}

export {TextPrompt}
