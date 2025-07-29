import {z} from 'zod'

// Test basic error structure
const schema = z.object({
  name: z.string(),
  age: z.number(),
})

const result = schema.safeParse({name: 'test', age: 'not-a-number'})

if (!result.success) {
  console.log('Error structure:', JSON.stringify(result.error.errors, null, 2))
  console.log('First error:', result.error.errors[0])
}

// Test with undefined message
const customSchema = z.object({
  field: z.string().refine(val => val.length > 5)
})

const customResult = customSchema.safeParse({field: 'abc'})
if (!customResult.success) {
  console.log('\nCustom error:', JSON.stringify(customResult.error.errors, null, 2))
}