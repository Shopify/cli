// Test script to check actual Zod 4 error messages
const { z } = require('zod');

// Test cases from json-schema.test.ts
const tests = [
  {
    name: 'required field',
    schema: z.object({ foo: z.string() }),
    data: {},
  },
  {
    name: 'nested required field', 
    schema: z.object({ foo: z.object({ bar: z.string() }) }),
    data: { foo: {} },
  },
  {
    name: 'type mismatch',
    schema: z.object({ foo: z.string().optional() }),
    data: { foo: 123 },
  },
  {
    name: 'enum error',
    schema: z.object({ foo: z.enum(['a', 'b']) }),
    data: { foo: 'c' },
  },
  {
    name: 'max number',
    schema: z.object({ foo: z.number().max(99) }),
    data: { foo: 100 },
  },
];

console.log('Zod 4 Error Messages:\n');

tests.forEach(test => {
  const result = test.schema.safeParse(test.data);
  if (!result.success) {
    console.log(`${test.name}:`);
    result.error.issues.forEach(issue => {
      console.log(`  Path: [${issue.path.map(p => `'${p}'`).join(', ')}]`);
      console.log(`  Message: "${issue.message}"`);
    });
    console.log();
  }
});