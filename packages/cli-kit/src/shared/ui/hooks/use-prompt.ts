import {useState} from 'react'

export enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
  Error = 'error',
  Cancelled = 'cancelled',
}

interface UsePromptProps<T> {
  initialAnswer: T
}

export default function usePrompt<T>({initialAnswer}: UsePromptProps<T>) {
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [answer, setAnswer] = useState<T>(initialAnswer)

  return {
    promptState,
    setPromptState,
    answer,
    setAnswer,
  }
}
