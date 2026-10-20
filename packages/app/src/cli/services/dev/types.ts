import {commandDiagnosticEventSchema, commandProgressEventSchema} from '@shopify/cli-kit/common/command-events'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const diagnosticSchema = commandDiagnosticEventSchema.omit({type: true})
const progressSchema = commandProgressEventSchema.omit({type: true})

export const appDevJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDevEvent',
  schema: zod.union([diagnosticSchema, progressSchema]),
  definitions: {
    AppDevDiagnostic: diagnosticSchema,
    AppDevProgress: progressSchema,
  },
})
