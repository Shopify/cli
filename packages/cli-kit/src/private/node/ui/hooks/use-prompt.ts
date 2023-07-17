import {useState} from 'react'

export enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
  Error = 'error',
}

export default function usePrompt() {
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)

  return {
    state: promptState,
    setState: setPromptState,
  }
}
