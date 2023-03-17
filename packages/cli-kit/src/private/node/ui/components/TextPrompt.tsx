import {TextInput} from './TextInput.js'
import {TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {messageWithPunctuation} from '../utilities.js'
import React, {FunctionComponent, useCallback, useEffect, useState} from 'react'
import {Box, useApp, Text, useStdin, Key} from 'ink'
import figures from 'figures'
import readline from 'readline'

interface Data {
  ctrl: boolean
  meta: boolean
  shift: boolean
  name: string
  sequence: string
}

type Handler = (key: string, data: Data) => void

const useInput = (inputHandler: Handler) => {
  const {stdin, setRawMode} = useStdin()

  useEffect(() => {
    readline.emitKeypressEvents(stdin)
    setRawMode(true)

    return () => {
      setRawMode(false)
    }
  }, [setRawMode, stdin])

  useEffect(() => {
    const handleData: Handler = (key, data) => {
      inputHandler(key, data)
    }

    stdin.on('keypress', handleData)

    return () => {
      stdin.off('keypress', handleData)
    }
  }, [stdin, inputHandler])
}

export interface TextPromptProps {
  message: string
  onSubmit: (value: string) => void
  defaultValue?: string
  password?: boolean
  validate?: (value: string) => string | undefined
  allowEmpty?: boolean
  multiline?: boolean
}

const TextPrompt: FunctionComponent<TextPromptProps> = ({
  message,
  onSubmit,
  validate,
  defaultValue = '',
  password = false,
  allowEmpty = false,
  multiline = false,
}) => {
  if (password && defaultValue) {
    throw new Error("Can't use defaultValue with password")
  }

  const validateAnswer = useCallback(
    (value: string): string | undefined => {
      if (validate) {
        return validate(value)
      }

      if (value.length === 0 && !allowEmpty) return 'Type an answer to the prompt.'

      return undefined
    },
    [allowEmpty, validate],
  )

  const {oneThird} = useLayout()
  const [answer, setAnswer] = useState<string>('')
  const answerOrDefault = answer.length > 0 ? answer : defaultValue
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const shouldShowError = submitted && error
  const color = shouldShowError ? 'red' : 'cyan'
  const underline = new Array(oneThird - 3).fill('▔')

  useInput((_key, data) => {
    handleCtrlC(data.name, data as unknown as Key)

    if (multiline && data.shift && data.name === 'return') {
      setSubmitted(true)
      const error = validateAnswer(answerOrDefault)
      setError(error)

      if (!error) {
        onSubmit(answerOrDefault)
        unmountInk()
      }
    }

    if (data.name === 'return') {
      if (multiline) {
        setAnswer((answer) => `${answer}\n`)
      } else {
        setSubmitted(true)
        const error = validateAnswer(answerOrDefault)
        setError(error)

        if (!error) {
          onSubmit(answerOrDefault)
          unmountInk()
        }
      }
    }
  })

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
          {shouldShowError ? (
            <Box marginLeft={3}>
              <Text color={color}>{error}</Text>
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  )
}

export {TextPrompt}
