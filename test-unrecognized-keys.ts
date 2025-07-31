import {z} from 'zod';

// Test unrecognized_keys error
try {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  }).strict();
  
  schema.parse({
    name: 'John',
    age: 30,
    extraKey: 'value',
    anotherKey: 'value2'
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log('Issues:', JSON.stringify(error.issues, null, 2));
    console.log('First issue:', error.issues[0]);
    console.log('Issue code:', error.issues[0]?.code);
    console.log('Issue keys:', (error.issues[0] as any)?.keys);
  }
}