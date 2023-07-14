import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTableProps} from './Prompts/InfoTable.js'
import {GitDiffProps} from './Prompts/GitDiff.js'
import {InfoMessageProps} from './Prompts/InfoMessage.js'
import {Message, PromptLayout} from './Prompts/PromptLayout.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import React, {ReactElement, useCallback, useState} from 'react'
import {useApp} from 'ink'

export interface SelectPromptProps<T> {
  message: Message
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  gitDiff?: GitDiffProps['gitDiff']
  defaultValue?: T
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
}

// eslint-disable-next-line react/function-component-definition
function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  infoMessage,
  gitDiff,
  onSubmit,
  defaultValue,
  abortSignal,
}: React.PropsWithChildren<SelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('SelectPrompt requires at least one choice')
  }
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(undefined)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      setAnswer(answer)
      setSubmitted(true)
      unmountInk()
      onSubmit(answer.value)
    },
    [unmountInk, onSubmit],
  )

  return (
    <PromptLayout
      message={message}
      submitted={submitted}
      submittedAnswerLabel={answer?.label}
      infoTable={infoTable}
      infoMessage={infoMessage}
      gitDiff={gitDiff}
      abortSignal={abortSignal}
      input={<SelectInput defaultValue={defaultValue} items={choices} onSubmit={submitAnswer} />}
    />
  )
}

export {SelectPrompt}
