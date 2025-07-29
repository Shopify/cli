const { z } = require('zod');

// Test the exact cases from the test file
const tests = [
  {
    name: 'required',
    schema: z.object({foo: z.string()}),
    data: {}
  },
  {
    name: 'wrong type',
    schema: z.object({foo: z.number()}),
    data: {foo: 'bar'}
  },
  {
    name: 'string enums',
    schema: z.object({foo: z.enum(['a', 'b'])}),
    data: {foo: 'c'}
  },
  {
    name: 'max number',
    schema: z.object({foo: z.number().max(99)}),
    data: {foo: 100}
  }
];

tests.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  const result = test.schema.safeParse(test.data);
  if (!result.success) {
    result.error.issues.forEach(issue => {
      console.log(`Path: ${JSON.stringify(issue.path)}`);
      console.log(`Message: "${issue.message}"`);
      console.log(`Code: "${issue.code}"`);
    });
  }
});

// Also test the union case
console.log('\n=== union with number/string/object/array ===');
const unionSchema = z.union([
  z.number(),
  z.string(),
  z.object({}),
  z.array(z.any())
]);
const unionResult = unionSchema.safeParse(false);
if (!unionResult.success) {
  unionResult.error.issues.forEach(issue => {
    console.log(`Path: ${JSON.stringify(issue.path)}`);
    console.log(`Message: "${issue.message}"`);
    console.log(`Code: "${issue.code}"`);
  });
}