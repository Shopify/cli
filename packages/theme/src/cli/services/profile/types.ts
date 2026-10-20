import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

// Speedscope owns this format; allow upstream extensions at every object boundary.
// See assets/speedscope/file-format-schema.json for the bundled viewer's contract.
const ProfileFrameSchema = zod
  .object({
    name: zod.string(),
    file: zod.string().optional(),
    line: zod.number().optional(),
    col: zod.number().optional(),
  })
  .passthrough()
const ProfileEventSchema = zod
  .object({
    type: zod.enum(['O', 'C']),
    at: zod.number(),
    frame: zod.number(),
  })
  .passthrough()
const ProfileBaseSchema = zod.object({
  name: zod.string(),
  unit: zod.enum(['bytes', 'microseconds', 'milliseconds', 'nanoseconds', 'none', 'seconds']),
  startValue: zod.number(),
  endValue: zod.number(),
})
const EventedProfileSchema = ProfileBaseSchema.extend({
  type: zod.literal('evented'),
  events: zod.array(ProfileEventSchema),
}).passthrough()
const SampledProfileSchema = ProfileBaseSchema.extend({
  type: zod.literal('sampled'),
  samples: zod.array(zod.array(zod.number())),
  weights: zod.array(zod.number()),
}).passthrough()
const ProfileSharedSchema = zod.object({frames: zod.array(ProfileFrameSchema)}).passthrough()

export const themeProfileResultSchema = zod
  .object({
    $schema: zod.literal('https://www.speedscope.app/file-format-schema.json'),
    shared: ProfileSharedSchema,
    profiles: zod.array(zod.discriminatedUnion('type', [EventedProfileSchema, SampledProfileSchema])),
    name: zod.string().optional(),
    exporter: zod.string().optional(),
    activeProfileIndex: zod.number().optional(),
  })
  .passthrough()
  .describe(
    'The native Speedscope file format, defined by its $schema URL. Original keys and extension fields are preserved.',
  )

export const themeProfileJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeProfileResult',
  schema: themeProfileResultSchema,
  project: (value) => value,
  definitions: {
    ProfileFrame: ProfileFrameSchema,
    ProfileEvent: ProfileEventSchema,
    ProfileShared: ProfileSharedSchema,
    EventedProfile: EventedProfileSchema,
    SampledProfile: SampledProfileSchema,
  },
})

export type ThemeProfileResult = zod.infer<typeof themeProfileResultSchema>
