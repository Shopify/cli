import {TextInput} from './TextInput.js'
import {TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import useLayout from '../hooks/use-layout.js'
import React, {FunctionComponent, useCallback, useState} from 'react'
import {Box, useApp, useInput, Text} from 'ink'
import figures from 'figures'
import {slugify} from '@shopify/cli-kit/common/string'

export interface ConfigNamePromptProps {
  onSubmit: (value: string) => void
  defaultValue?: string
  validate?: (value: string) => string | undefined
}

const ConfigNamePrompt: FunctionComponent<ConfigNamePromptProps> = ({onSubmit, validate, defaultValue = ''}) => {
  const validateAnswer = useCallback(
    (value: string): string | undefined => {
      if (validate) {
        return validate(value)
      }

      if (value.length === 0) return 'Type an answer to the prompt.'
      // Max filename size for Windows/Mac including the prefix/postfix
      if (value.length > 238) return 'The name is too long.'
      return undefined
    },
    [validate],
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
  const message = 'Configuration file name:'

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (key.return) {
      setSubmitted(true)
      const error = validateAnswer(answerOrDefault)
      setError(error)

      if (!error) {
        onSubmit(slugify(answerOrDefault))
        unmountInk()
      }
    }
  })

  const formatAnswer = (text: string) => {
    return slugify(text)
  }

  return (
    <>
      <Box flexDirection="column" marginBottom={1} width={oneThird}>
        <Box>
          <Box marginRight={2}>
            <Text>?</Text>
          </Box>
          <TokenizedText item={message} />
        </Box>
        {submitted && !error ? (
          <Box>
            <Box marginRight={2}>
              <Text color="cyan">{figures.tick}</Text>
            </Box>

            <Box flexGrow={1}>
              <Text color="cyan" dimColor>
                {answerOrDefault}
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
                    setSubmitted(false)
                  }}
                  defaultValue={defaultValue}
                  color={color}
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
      <Box>
        <Text>shopify.app.</Text>
        <Text color={color}>{answer ? formatAnswer(answer) : formatAnswer(defaultValue)}</Text>
        <Text>.toml</Text>

        <Text>
          {submitted && !error ? ' created in your root directory\n' : ' will be generated in your root directory\n'}
        </Text>
      </Box>
    </>
  )
}

export {ConfigNamePrompt}
