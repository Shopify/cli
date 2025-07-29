import {z} from 'zod';

// Test 1: Check how literal errors work
try {
  z.literal('test').parse(null);
} catch (error) {
  console.log('=== Literal Error ===');
  console.log('Constructor:', error.constructor.name);
  if (error instanceof z.ZodError) {
    console.log('Is ZodError:', true);
    console.log('Issues:', JSON.stringify(error.issues, null, 2));
  }
}

// Test 2: Check required field error
try {
  z.object({ name: z.string() }).parse({});
} catch (error) {
  console.log('\n=== Required Field Error ===');
  console.log('Constructor:', error.constructor.name);
  if (error instanceof z.ZodError) {
    console.log('Is ZodError:', true);
    console.log('Issues:', JSON.stringify(error.issues, null, 2));
  }
}

// Test 3: Check type mismatch error
try {
  z.string().parse(123);
} catch (error) {
  console.log('\n=== Type Mismatch Error ===');
  console.log('Constructor:', error.constructor.name);
  if (error instanceof z.ZodError) {
    console.log('Is ZodError:', true);
    console.log('Issues:', JSON.stringify(error.issues, null, 2));
  }
}

// Test 4: Check if we can match errors
const testError = new z.ZodError([
  {
    code: 'invalid_type',
    expected: 'string',
    received: 'undefined',
    path: ['payment_session_url'],
    message: 'Required',
  }
]);

console.log('\n=== Manual Error Creation ===');
console.log('Manual error issues:', JSON.stringify(testError.issues, null, 2));