const { execSync } = require('child_process');

// Create a test file that will run in the actual test environment
const testCode = `
const { zod } = require('@shopify/cli-kit/node/schema');

// Test each case from the json-schema.test.ts file
const tests = [
  {
    name: 'required',
    schema: zod.object({foo: zod.string()}),
    data: {}
  },
  {
    name: 'nested required field',
    schema: zod.object({
      foo: zod.object({
        bar: zod.string(),
      }),
    }),
    data: {foo: {}}
  },
  {
    name: 'top-level type mismatch',
    schema: zod.object({foo: zod.string().optional()}),
    data: {foo: 123}
  },
  {
    name: 'string enums',
    schema: zod.object({foo: zod.enum(['a', 'b'])}),
    data: {foo: 'c'}
  },
  {
    name: 'max number',
    schema: zod.object({foo: zod.number().max(99)}),
    data: {foo: 100}
  }
];

tests.forEach(test => {
  console.log(\`\\n=== \${test.name} ===\`);
  const result = test.schema.safeParse(test.data);
  if (!result.success) {
    const errors = result.error.issues.map((error) => ({path: error.path, message: error.message}));
    console.log('Errors:', JSON.stringify(errors, null, 2));
  }
});
`;

// Write the test file
require('fs').writeFileSync('/tmp/test-zod-messages.js', testCode);

try {
  // Run it in the actual project context
  const output = execSync('cd packages/cli-kit && node /tmp/test-zod-messages.js', { encoding: 'utf8' });
  console.log(output);
} catch (e) {
  console.log('Error running test:', e.message);
  console.log('Output:', e.stdout?.toString());
  console.log('Error output:', e.stderr?.toString());
}