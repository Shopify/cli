import {z} from 'zod'

// Test required field error
const schema1 = z.object({
  foo: z.string(),
})
const result1 = schema1.safeParse({})
if (!result1.success) {
  console.log('Required field:', result1.error.issues[0])
}

// Test type mismatch
const schema2 = z.object({
  foo: z.string().optional(),
})
const result2 = schema2.safeParse({foo: 123})
if (!result2.success) {
  console.log('\nType mismatch:', result2.error.issues[0])
}

// Test enum
const schema3 = z.object({
  foo: z.enum(['a', 'b']),
})
const result3 = schema3.safeParse({foo: 'c'})
if (!result3.success) {
  console.log('\nEnum error:', result3.error.issues[0])
}

// Test max number
const schema4 = z.object({
  foo: z.number().max(99),
})
const result4 = schema4.safeParse({foo: 100})
if (!result4.success) {
  console.log('\nMax number:', result4.error.issues[0])
}

// Test nested required
const schema5 = z.object({
  foo: z.object({
    bar: z.string(),
  }),
})
const result5 = schema5.safeParse({foo: {}})
if (!result5.success) {
  console.log('\nNested required:', result5.error.issues[0])
}

// Test boolean required
const schema6 = z.object({
  embedded: z.boolean(),
})
const result6 = schema6.safeParse({embedded: undefined})
if (!result6.success) {
  console.log('\nBoolean required:', result6.error.issues[0])
}