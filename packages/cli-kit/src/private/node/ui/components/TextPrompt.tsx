import {TextInput} from './TextInput.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import React, {useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import {figures} from 'listr2'

export interface Props {
  message: string
  onSubmit: (value: string) => void
  placeholder?: string
}

const TextPrompt: React.FC<Props> = ({message, onSubmit, placeholder}) => {
  const {oneThird} = useLayout()
  const [answer, setAnswer] = useState<string>('')
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [valid, setValid] = useState(false)
  const underline = new Array(oneThird - 3).fill('▔')

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return) {
          setSubmitted(true)

          if (valid) {
            onSubmit(answer)
            unmountInk()
          }
        }
      },
      [answer, onSubmit, valid],
    ),
  )

  const shouldShowError = submitted && !valid
  const color = shouldShowError ? 'red' : 'cyan'
  const error = shouldShowError ? 'Please enter a value' : undefined

  return (
    <Box flexDirection="column" marginBottom={1} width={oneThird}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
      </Box>
      {submitted && valid ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Box flexGrow={1}>
            <Text color="cyan">{answer}</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box marginRight={2}>
              <Text color={color}>{`>`}</Text>
            </Box>
            <Box flexGrow={1}>
              <TextInput
                value={answer}
                onChange={(answer) => {
                  setAnswer(answer)
                  setValid(answer.length > 0)
                  setSubmitted(false)
                }}
                placeholder={placeholder}
                color={color}
              />
            </Box>
          </Box>
          <Box marginLeft={3}>
            <Text color={color}>{underline}</Text>
          </Box>
          {error && (
            <Box marginLeft={3}>
              <Text color={color}>{error}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export {TextPrompt}
