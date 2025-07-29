const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, verbose: true });

const schema = {
  type: 'object',
  properties: {
    foo: { type: 'number', maximum: 99 }
  },
  required: ['foo']
};

const data = { foo: 100 };

const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  console.log('Validation errors:');
  validate.errors.forEach(error => {
    console.log('\nError object:');
    console.log('  keyword:', error.keyword);
    console.log('  params:', error.params);
    console.log('  message:', error.message);
    console.log('  schemaPath:', error.schemaPath);
    console.log('  instancePath:', error.instancePath);
  });
}