import {TextInput} from './TextInput.js'
import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {messageWithPunctuation} from '../utilities.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'
import React, {FunctionComponent, useCallback, useEffect, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import figures from 'figures'

export interface TextPromptProps {
  message: TokenItem
  onSubmit: (value: string) => void
  defaultValue?: string
  password?: boolean
  validate?: (value: string) => string | undefined
  allowEmpty?: boolean
  emptyDisplayedValue?: string
  abortSignal?: AbortSignal
  preview?: (value: string) => TokenItem<InlineToken>
  initialAnswer?: string
  noUnderline?: boolean
}

const TextPrompt: FunctionComponent<TextPromptProps> = ({
  message,
  onSubmit,
  validate,
  defaultValue = '',
  password = false,
  allowEmpty = false,
  emptyDisplayedValue = '(empty)',
  abortSignal,
  preview,
  initialAnswer = '',
  noUnderline = false,
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
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<string>({
    initialAnswer,
  })
  const answerOrDefault = answer.length > 0 ? answer : defaultValue
  const displayEmptyValue = answerOrDefault === ''
  const displayedAnswer = displayEmptyValue ? emptyDisplayedValue : answerOrDefault
  const {exit: unmountInk} = useApp()
  const [error, setError] = useState<string | undefined>(undefined)
  const color = promptState === PromptState.Error ? 'red' : 'cyan'
  const underline = new Array(oneThird - 3).fill('▔')
  const {isAborted} = useAbortSignal(abortSignal)

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (key.return) {
      const error = validateAnswer(answerOrDefault)

      if (error) {
        setPromptState(PromptState.Error)
        setError(error)
      } else {
        setPromptState(PromptState.Submitted)
      }
    }
  })

  useEffect(() => {
    if (promptState === PromptState.Submitted) {
      onSubmit(answerOrDefault)
      unmountInk()
    }
  }, [answerOrDefault, onSubmit, promptState, unmountInk])

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} width={oneThird}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {promptState === PromptState.Submitted ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Box flexGrow={1}>
            <Text color="cyan" dimColor={displayEmptyValue}>
              {password ? '*'.repeat(answer.length) : displayedAnswer}
            </Text>
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
                  setPromptState(PromptState.Idle)
                }}
                defaultValue={defaultValue}
                color={color}
                password={password}
              />
            </Box>
          </Box>
          {noUnderline ? null : (
            <Box marginLeft={3}>
              <Text color={color}>{underline}</Text>
            </Box>
          )}
          {promptState === PromptState.Error ? (
            <Box marginLeft={3}>
              <Text color={color}>{error}</Text>
            </Box>
          ) : null}
          {promptState !== PromptState.Error && preview ? (
            <Box marginLeft={3}>
              <TokenizedText item={preview(answerOrDefault)} />
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  )
}

export {TextPrompt}
