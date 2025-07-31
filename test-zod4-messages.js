import { z } from 'zod'

// Test required field
const requiredSchema = z.object({
  foo: z.string(),
})
const req = requiredSchema.safeParse({})
console.log('Required field:', req.error?.issues[0])

// Test type mismatch
const typeSchema = z.object({
  foo: z.string().optional(),
})
const type = typeSchema.safeParse({ foo: 123 })
console.log('Type mismatch:', type.error?.issues[0])

// Test enum
const enumSchema = z.object({
  foo: z.enum(['a', 'b']),
})
const en = enumSchema.safeParse({ foo: 'c' })
console.log('Enum:', en.error?.issues[0])

// Test max number
const maxSchema = z.object({
  foo: z.number().max(99),
})
const max = maxSchema.safeParse({ foo: 100 })
console.log('Max number:', max.error?.issues[0])