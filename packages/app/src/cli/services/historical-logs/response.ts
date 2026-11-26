import {nativeLogRecord} from './types.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const historicalLogsSchema = zod.object({
  app: zod
    .object({
      logs: zod
        .object({
          records: zod.array(zod.object({json: nativeLogRecord})),
        })
        .nullable(),
    })
    .nullable(),
})
