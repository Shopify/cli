const { z } = require('zod');

// Test various error scenarios to see Zod 4's error messages

// 1. Required field
try {
  z.object({ name: z.string() }).parse({});
} catch (e) {
  console.log('Required field error:', e.issues[0].message);
}

// 2. Type mismatch
try {
  z.string().parse(123);
} catch (e) {
  console.log('Type mismatch error:', e.issues[0].message);
}

// 3. Enum error
try {
  z.enum(['a', 'b']).parse('c');
} catch (e) {
  console.log('Enum error:', e.issues[0].message);
}

// 4. Max number error
try {
  z.number().max(99).parse(100);
} catch (e) {
  console.log('Max number error:', e.issues[0].message);
}

// 5. Nested required field
try {
  z.object({ user: z.object({ name: z.string() }) }).parse({ user: {} });
} catch (e) {
  console.log('Nested required field error:', e.issues[0].message);
}