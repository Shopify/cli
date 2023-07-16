import {TextInput} from './TextInput.js'
import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {messageWithPunctuation} from '../utilities.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import React, {FunctionComponent, useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import figures from 'figures'

export interface TextPromptProps {
  message: string
  infoTable?: InfoTableProps['table']
  finalInstruction?: TokenItem<InlineToken>
  exitOnEsc?: boolean
  successMessage?: string
  onSubmit: (value: string | undefined) => void
  defaultValue?: string
  password?: boolean
  validate?: (value: string) => TokenItem<InlineToken> | undefined
  allowEmpty?: boolean
  emptyDisplayedValue?: string
  abortSignal?: AbortSignal
  previewPrefix?: (value: string) => string | undefined
  previewValue?: (value: string) => string | undefined
  previewSuffix?: (value: string) => string | undefined
}

const TextPrompt: FunctionComponent<TextPromptProps> = ({
  message,
  infoTable,
  finalInstruction,
  exitOnEsc = false,
  successMessage,
  onSubmit,
  validate,
  defaultValue = '',
  password = false,
  allowEmpty = false,
  emptyDisplayedValue = '(empty)',
  abortSignal,
  previewPrefix,
  previewValue,
  previewSuffix,
}) => {
  if (password && defaultValue) {
    throw new Error("Can't use defaultValue with password")
  }

  const validateAnswer = useCallback(
    (value: string): TokenItem<InlineToken> | undefined => {
      if (validate) {
        return validate(value)
      }

      if (value.length === 0 && !allowEmpty) return 'Type an answer to the prompt.'

      return undefined
    },
    [allowEmpty, validate],
  )

  const {oneThird, twoThirds} = useLayout()
  const [answer, setAnswer] = useState<string>('')
  const answerOrDefault = answer.length > 0 ? answer : defaultValue
  const displayEmptyValue = answerOrDefault === ''
  const displayedAnswer = displayEmptyValue ? emptyDisplayedValue : answerOrDefault
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState<TokenItem<InlineToken> | undefined>(undefined)
  const shouldShowError = submitted && error
  const color = shouldShowError ? 'red' : 'cyan'
  const underline = new Array(oneThird - 3).fill('▔')
  const {isAborted} = useAbortSignal(abortSignal)

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (exitOnEsc && key.escape) {
      setSubmitted(true)
      setCancelled(true)
      setError(undefined)
      onSubmit(undefined)
      unmountInk()
    }

    if (key.return) {
      setSubmitted(true)
      const error = validateAnswer(answerOrDefault)
      setError(error)

      if (!error) {
        onSubmit(answerOrDefault)
        unmountInk()
      }
    }
  })

  const completed = submitted && !error

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} width={twoThirds}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {completed ? (
        <CompletedPrompt {...{cancelled, displayEmptyValue, successMessage, password, answer, displayedAnswer}} />
      ) : (
        <>
          {infoTable || finalInstruction ? (
            <Box flexDirection="column" gap={1} marginTop={1} marginLeft={3}>
              <Box
                paddingLeft={2}
                borderStyle="bold"
                borderLeft
                borderRight={false}
                borderTop={false}
                borderBottom={false}
                flexDirection="column"
                gap={1}
              >
                {infoTable ? <InfoTable table={infoTable} /> : null}
              </Box>
              <Box>{finalInstruction ? <TokenizedText item={finalInstruction} /> : null}</Box>
            </Box>
          ) : null}
          <Box flexDirection="column" width={oneThird}>
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
                <Text color={color}>
                  <TokenizedText item={error} />
                </Text>
              </Box>
            ) : null}
          </Box>
          {previewValue && !submitted ? (
            <Box marginLeft={3}>
              <Text>
                <Text>{previewPrefix ? previewPrefix(answerOrDefault) : null}</Text>
                <Text color={color}>{previewValue(answerOrDefault)}</Text>
                <Text>{previewSuffix ? previewSuffix(answerOrDefault) : null}</Text>
              </Text>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  )
}

interface CompletedPromptProps {
  cancelled: boolean
  displayEmptyValue: boolean
  successMessage?: string
  password?: boolean
  answer: string
  displayedAnswer: string
}

const CompletedPrompt: FunctionComponent<CompletedPromptProps> = ({
  cancelled,
  displayEmptyValue,
  successMessage,
  password,
  answer,
  displayedAnswer,
}) => {
  if (cancelled) {
    return (
      <Box>
        <Box marginRight={2}>
          <Text color="red">{figures.cross}</Text>
        </Box>

        <Box flexGrow={1}>
          <Text color="red">Cancelled</Text>
        </Box>
      </Box>
    )
  } else {
    return (
      <Box>
        <Box marginRight={2}>
          <Text color="cyan">{figures.tick}</Text>
        </Box>

        <Box flexGrow={1}>
          <Text color="cyan" dimColor={displayEmptyValue}>
            {successMessage ?? (password ? '*'.repeat(answer.length) : displayedAnswer)}
          </Text>
        </Box>
      </Box>
    )
  }
}

export {TextPrompt}
