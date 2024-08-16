export interface FunctionRunFromRunner {
  type: 'functionRun'
  input: string
  output: string
  logs: string
  name: string
  size: number
  memory_usage: number
  instructions: number
}

interface SystemMessage {
  type: 'systemMessage'
  message: string
}

export type ReplayLog = FunctionRunFromRunner | SystemMessage
