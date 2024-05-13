import {Writable} from 'stream'
import type {AppLog} from './fetch_app_logs.js'

// Helper Methods for displaying app logs for type: function-run
const functionErrorOutput = ({
  event,
  stdout,
}: {
  event: {
    type: string
    shop_id: number
    app_id: number
    event_timestamp: string
    payload: AppLog
  }
  stdout: Writable
}) => {
  const part1 = `❌ ${event.type === 'function-run' ? 'Function' : 'other?'} my-product-discount failed to execute: ${
    event.payload.error_type
  }`
  const part2 = event.payload.logs || 'no logs found'
  const part25 = event.payload.error_message
  const part3 = 'Log: /~/my-product-discount'
  stdout.write(part1)
  stdout.write(part2)
  stdout.write(part25)
  stdout.write(part3)
}
const functionSuccessOutput = ({
  event,
  stdout,
}: {
  // event: {
  //   type: string
  //   shop_id: number
  //   app_id: number
  //   event_timestamp: string
  //   payload: AppLog
  // }
  event: string
  stdout: Writable
}) => {
  // const part1 = `✅ ${event.type === 'function-run' ? 'Function' : 'other?'} executed in ${
  //   event.payload?.fuel_consumed
  // } instructions:`
  // const part2 = event.payload.logs
  // const part3 = 'some more custom logging about discounting'
  // const part4 = 'Log: /~/my-product-discount'
  stdout.write(event)
}

export const functionOutput = ({
  log,
  stdout,
}: {
  // log: {
  //   type: string
  //   shop_id: number
  //   app_id: number
  //   event_timestamp: string
  //   payload: AppLog
  // }
  log: string
  stdout: Writable
}) => {
  // if (log.payload.error_type) {
  //   functionErrorOutput({event: log, stdout})
  // } else {
  //   functionSuccessOutput({event: log, stdout})
  // }
  functionSuccessOutput({event: log, stdout})
}
