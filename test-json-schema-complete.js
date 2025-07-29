// This test file simulates the exact test cases from json-schema.test.ts
const fs = require('fs');
const path = require('path');

// Create a test module that imports the actual functions
const testCode = `
const { jsonSchemaValidate } = require('./packages/cli-kit/src/public/node/json-schema.js');
const { zod } = require('./packages/cli-kit/src/public/node/schema.js');

// Define the test cases exactly as they appear in the test file
const testCases = [
  {
    name: 'required',
    contract: {type: 'object', properties: {foo: {type: 'string'}}, required: ['foo']},
    zodVersion: zod.object({foo: zod.string()}),
    subject: {}
  },
  {
    name: 'nested required field',
    contract: {
      type: 'object',
      properties: {
        foo: {type: 'object', properties: {bar: {type: 'string'}}, required: ['bar']},
      },
      required: ['foo'],
    },
    zodVersion: zod.object({
      foo: zod.object({
        bar: zod.string(),
      }),
    }),
    subject: {foo: {}}
  },
  {
    name: 'top-level type mismatch',
    contract: {type: 'object', properties: {foo: {type: 'string'}}},
    zodVersion: zod.object({foo: zod.string().optional()}),
    subject: {foo: 123}
  },
  {
    name: 'string enums',
    contract: {type: 'object', properties: {foo: {enum: ['a', 'b']}}, required: ['foo']},
    zodVersion: zod.object({foo: zod.enum(['a', 'b'])}),
    subject: {foo: 'c'}
  },
  {
    name: 'max number',
    contract: {type: 'object', properties: {foo: {type: 'number', maximum: 99}}, required: ['foo']},
    zodVersion: zod.object({foo: zod.number().max(99)}),
    subject: {foo: 100}
  }
];

console.log('=== Testing JSON Schema vs Zod Error Messages ===\\n');

testCases.forEach(testCase => {
  console.log(\`Test: \${testCase.name}\`);
  
  // Get Zod errors
  const zodParsed = testCase.zodVersion.safeParse(testCase.subject);
  if (!zodParsed.success) {
    const zodErrors = zodParsed.error.issues.map((error) => ({path: error.path, message: error.message}));
    console.log('Zod errors:', JSON.stringify(zodErrors, null, 2));
  }
  
  // Get JSON schema errors
  const schemaParsed = jsonSchemaValidate(testCase.subject, testCase.contract, 'strip');
  if (schemaParsed.state === 'error') {
    console.log('JSON Schema errors:', JSON.stringify(schemaParsed.errors, null, 2));
    if (schemaParsed.rawErrors) {
      console.log('Raw AJV errors:', JSON.stringify(schemaParsed.rawErrors.map(e => ({
        keyword: e.keyword,
        params: e.params,
        message: e.message,
        instancePath: e.instancePath,
        schemaPath: e.schemaPath
      })), null, 2));
    }
  }
  
  // Compare
  const zodErrorsStr = JSON.stringify(zodErrors);
  const schemaErrorsStr = JSON.stringify(schemaParsed.errors);
  console.log('Match:', zodErrorsStr === schemaErrorsStr ? '✓' : '✗');
  console.log('---\\n');
});
`;

// Write the test file
fs.writeFileSync(path.join(__dirname, 'run-json-schema-test.js'), testCode);
console.log('Test file created. To run it:');
console.log('cd /Users/arielcaplan/dev/experiments/cli && node run-json-schema-test.js');