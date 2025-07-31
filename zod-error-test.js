const { z } = require('zod');

// Test case from the failing tests
try {
  z.object({
    payment_session_url: z.string()
  }).parse({
    payment_session_url: undefined
  });
} catch (error) {
  console.log('=== Testing payment_session_url undefined ===');
  console.log('Error constructor:', error.constructor.name);
  console.log('Is ZodError:', error instanceof z.ZodError);
  console.log('Issues:', JSON.stringify(error.issues, null, 2));
}

// Test literal error
try {
  z.literal('payments.redeemable.render').parse(null);
} catch (error) {
  console.log('\n=== Testing literal null ===');
  console.log('Error constructor:', error.constructor.name);
  console.log('Is ZodError:', error instanceof z.ZodError);
  console.log('Issues:', JSON.stringify(error.issues, null, 2));
}

// Test what toThrowError expects
const testFn = () => {
  z.string().parse(undefined);
};

try {
  testFn();
} catch (error) {
  console.log('\n=== Testing for vitest compatibility ===');
  console.log('Error message:', error.message);
  console.log('Error toString():', error.toString());
}