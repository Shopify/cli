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

export interface DangerousConfirmationPromptProps {
  message: string
  confirmation: string
  infoTable?: InfoTableProps['table']
  onSubmit: (value: boolean) => void
  abortSignal?: AbortSignal
}

const DangerousConfirmationPrompt: FunctionComponent<DangerousConfirmationPromptProps> = ({
  message,
  confirmation,
  infoTable,
  onSubmit,
  abortSignal,
}) => {
  const validateAnswer = useCallback(
    (value: string): TokenItem<InlineToken> | undefined => {
      return value === confirmation ? undefined : ['Value must be exactly', {userInput: confirmation}]
    },
    [confirmation],
  )

  const {oneThird, twoThirds} = useLayout()
  const [answer, setAnswer] = useState<string>('')
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

    if (key.escape) {
      setSubmitted(true)
      setCancelled(true)
      setError(undefined)
      onSubmit(false)
      unmountInk()
    }

    if (key.return) {
      setSubmitted(true)
      const error = validateAnswer(answer)
      setError(error)

      if (!error) {
        onSubmit(true)
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
        <CompletedPrompt {...{cancelled}} />
      ) : (
        <>
          <Box flexDirection="column" gap={1} marginTop={1} marginLeft={3}>
            {infoTable ? (
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
                <InfoTable table={infoTable} />
              </Box>
            ) : null}
            <Box>
              <TokenizedText item={['Type', {userInput: confirmation}, 'to confirm, or press Escape to cancel.']} />
            </Box>
          </Box>
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
                  defaultValue=""
                  color={color}
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
        </>
      )}
    </Box>
  )
}

interface CompletedPromptProps {
  cancelled: boolean
}

const CompletedPrompt: FunctionComponent<CompletedPromptProps> = ({cancelled}) => (
  <Box>
    <Box marginRight={2}>
      {cancelled ? <Text color="red">{figures.cross}</Text> : <Text color="cyan">{figures.tick}</Text>}
    </Box>

    <Box flexGrow={1}>{cancelled ? <Text color="red">Cancelled</Text> : <Text color="cyan">Confirmed</Text>}</Box>
  </Box>
)

export {DangerousConfirmationPrompt}
