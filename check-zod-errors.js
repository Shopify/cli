import {z} from 'zod'

// Test 1: Required field
const requiredSchema = z.object({
  foo: z.string(),
})
const result1 = requiredSchema.safeParse({})
console.log('Required field error:', result1.error?.issues[0])

// Test 2: Nested required field
const nestedSchema = z.object({
  foo: z.object({
    bar: z.string(),
  }),
})
const result2 = nestedSchema.safeParse({foo: {}})
console.log('\nNested required field error:', result2.error?.issues[0])

// Test 3: Type mismatch
const typeSchema = z.object({foo: z.string().optional()})
const result3 = typeSchema.safeParse({foo: 123})
console.log('\nType mismatch error:', result3.error?.issues[0])

// Test 4: String enum
const enumSchema = z.object({foo: z.enum(['a', 'b'])})
const result4 = enumSchema.safeParse({foo: 'c'})
console.log('\nString enum error:', result4.error?.issues[0])

// Test 5: Max number
const maxSchema = z.object({foo: z.number().max(99)})
const result5 = maxSchema.safeParse({foo: 100})
console.log('\nMax number error:', result5.error?.issues[0])