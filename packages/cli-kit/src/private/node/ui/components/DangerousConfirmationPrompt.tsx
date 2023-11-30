import {TextInput} from './TextInput.js'
import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {GitDiff, GitDiffProps} from './Prompts/GitDiff.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import {messageWithPunctuation} from '../utilities.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'
import React, {FunctionComponent, useCallback, useEffect, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import figures from 'figures'
import {capitalize} from '@shopify/cli-kit/common/string'

export interface DangerousConfirmationPromptProps {
  message: string
  confirmation: string
  infoTable?: InfoTableProps['table']
  gitDiff?: GitDiffProps['gitDiff'] & {title?: string}
  onSubmit: (value: boolean) => void
  abortSignal?: AbortSignal
}

const DangerousConfirmationPrompt: FunctionComponent<DangerousConfirmationPromptProps> = ({
  message,
  confirmation,
  infoTable,
  gitDiff,
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
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<string>({
    initialAnswer: '',
  })
  const {exit: unmountInk} = useApp()
  const [error, setError] = useState<TokenItem<InlineToken> | undefined>(undefined)
  const color = promptState === PromptState.Error ? 'red' : 'cyan'
  const underline = new Array(oneThird - 3).fill('▔')
  const {isAborted} = useAbortSignal(abortSignal)

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (key.escape) {
      setPromptState(PromptState.Cancelled)
      setError(undefined)
    }

    if (key.return) {
      const error = validateAnswer(answer)

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
      onSubmit(true)
      unmountInk()
    } else if (promptState === PromptState.Cancelled) {
      onSubmit(false)
      unmountInk()
    }
  }, [onSubmit, promptState, unmountInk])

  const completed = promptState === PromptState.Submitted || promptState === PromptState.Cancelled

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} width={twoThirds}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
      </Box>
      {completed ? (
        <CompletedPrompt {...{cancelled: promptState === PromptState.Cancelled}} />
      ) : (
        <>
          <Box flexDirection="column" gap={1} marginTop={1} marginLeft={3}>
            {infoTable || gitDiff ? (
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
                {gitDiff ? (
                  <Box flexDirection="column">
                    <Box>
                      <Text>{capitalize(gitDiff.title ?? 'Configuration:')}</Text>
                    </Box>
                    <GitDiff gitDiff={gitDiff} />
                  </Box>
                ) : null}
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
                    setPromptState(PromptState.Idle)
                  }}
                  defaultValue=""
                  color={color}
                />
              </Box>
            </Box>
            <Box marginLeft={3}>
              <Text color={color}>{underline}</Text>
            </Box>
            {promptState === PromptState.Error && error ? (
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
