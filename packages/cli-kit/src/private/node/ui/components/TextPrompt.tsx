import {TextInput} from './TextInput.js'
import {TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {messageWithPunctuation} from '../utilities.js'
import React, {useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import figures from 'figures'

export interface Props {
  message: string
  onSubmit: (value: string) => void
  defaultValue?: string
  password?: boolean
  validate?: (value: string) => string | undefined
}

const TextPrompt: React.FC<Props> = ({message, onSubmit, validate, defaultValue = '', password = false}) => {
  if (password && defaultValue) {
    throw new Error("Can't use defaultValue with password")
  }

  const validateAnswer = (value: string): string | undefined => {
    if (validate) {
      return validate(value)
    }

    if (value.length === 0) return 'Type an answer to the prompt.'

    return undefined
  }
  const {oneThird} = useLayout()
  const [answer, setAnswer] = useState<string>('')
  const answerOrDefault = answer.length > 0 ? answer : defaultValue
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const shouldShowError = submitted && error
  const color = shouldShowError ? 'red' : 'cyan'
  const underline = new Array(oneThird - 3).fill('▔')

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return) {
          setSubmitted(true)
          const error = validateAnswer(answerOrDefault)
          setError(error)

          if (!error) {
            onSubmit(answerOrDefault)
            unmountInk()
          }
        }
      },
      [answerOrDefault, onSubmit],
    ),
  )

  return (
    <Box flexDirection="column" marginBottom={1} width={oneThird}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {submitted && !error ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Box flexGrow={1}>
            <Text color="cyan">{password ? '*'.repeat(answer.length) : answerOrDefault}</Text>
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
                  setSubmitted(false)
                }}
                defaultValue={defaultValue}
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
