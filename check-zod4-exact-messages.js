const { z } = require('zod');

// Test cases from the test file
const cases = [
  {
    name: 'required field',
    schema: z.object({ foo: z.string() }),
    data: {}
  },
  {
    name: 'nested required field',
    schema: z.object({ foo: z.object({ bar: z.string() }) }),
    data: { foo: {} }
  },
  {
    name: 'type mismatch',
    schema: z.object({ foo: z.string().optional() }),
    data: { foo: 123 }
  },
  {
    name: 'string enums',
    schema: z.object({ foo: z.enum(['a', 'b']) }),
    data: { foo: 'c' }
  },
  {
    name: 'max number',
    schema: z.object({ foo: z.number().max(99) }),
    data: { foo: 100 }
  }
];

cases.forEach(({ name, schema, data }) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.log(`\n${name}:`);
    result.error.issues.forEach(issue => {
      console.log(`  path: [${issue.path.map(p => `'${p}'`).join(', ')}]`);
      console.log(`  message: "${issue.message}"`);
    });
  }
});