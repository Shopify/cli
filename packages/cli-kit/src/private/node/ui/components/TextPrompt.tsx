import {TextInput} from './TextInput.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import React, {useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import {figures} from 'listr2'

export interface Props {
  message: string
  onSubmit: (value: string) => void
  defaultValue?: string
  placeholder?: string
  password?: boolean
  validate?: (value: string) => string | undefined
}

const TextPrompt: React.FC<Props> = ({
  message,
  onSubmit,
  placeholder,
  validate,
  defaultValue = '',
  password = false,
}) => {
  const validateAnswer = (value: string): string | undefined => {
    if (validate) {
      return validate(value)
    }

    if (value.length === 0) return 'Type an answer to the prompt.'

    return undefined
  }
  const {oneThird} = useLayout()
  const [answer, setAnswer] = useState<string>(defaultValue)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(validateAnswer(answer))
  const valid = !error
  const shouldShowError = submitted && !valid
  const color = shouldShowError ? 'red' : 'cyan'
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
            <Text color="cyan">{password ? '*'.repeat(answer.length) : answer}</Text>
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
                  setError(validateAnswer(answer))
                  setSubmitted(false)
                }}
                placeholder={placeholder}
                color={color}
                password={password}
              />
            </Box>
          </Box>
          <Box marginLeft={3}>
            <Text color={color}>{underline}</Text>
          </Box>
          {shouldShowError && (
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
