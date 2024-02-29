export type AppEvent = FunctionRunEvent

interface FunctionRunEvent {
  type: 'function-run'
  input: string
  input_bytes: number
  output: string
  output_bytes: number
  logs: string
  function_id: string
  fuel_consumed: number
  error_message: string | null
  error_type: string | null
}

export function mockAppEvents(): AppEvent[] {
  return [
    {
      type: 'function-run',
      input: '{}',
      input_bytes: 13,
      output: '{}',
      output_bytes: 13,
      logs: 'Hello, world!',
      function_id: '12244609-78a5-45a1-9372-8bdf78121c2b',
      fuel_consumed: 10000,
      error_message: null,
      error_type: null,
    },
  ]
}
