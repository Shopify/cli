type TestStatus = 'passed' | 'failed' | 'skipped'

export interface AssertionResult {
  description: string
  passed: boolean
  expected?: unknown
  actual?: unknown
}

export interface TestResult {
  name: string
  status: TestStatus
  duration: number
  assertions: AssertionResult[]
  error?: Error
}

export interface DoctorContext {
  workingDirectory: string
  data: {[key: string]: unknown}
}
