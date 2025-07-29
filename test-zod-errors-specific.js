const { z } = require('zod');

// Test specific error cases
console.log('=== Testing Zod 4 Error Messages ===\n');

// 1. Test enum errors
console.log('1. Enum error:');
try {
  const schema = z.enum(['boolean', 'color', 'date_time']);
  schema.parse('year');
} catch (e) {
  console.log(`Message: "${e.errors[0].message}"`);
  console.log(`Code: "${e.errors[0].code}"`);
}

// 2. Test union errors
console.log('\n2. Union error:');
try {
  const schema = z.union([
    z.string().regex(/test/),
    z.enum(['boolean', 'color'])
  ]);
  schema.parse('year');
} catch (e) {
  console.log(`Message: "${e.errors[0].message}"`);
  console.log(`Code: "${e.errors[0].code}"`);
}

// 3. Test additional properties
console.log('\n3. Object with unknown keys:');
try {
  const schema = z.object({
    name: z.string().optional(),
    type: z.string().optional()
  }).strict();
  schema.parse({ name: 'test', extra: 'value' });
} catch (e) {
  console.log(`Message: "${e.errors[0].message}"`);
  console.log(`Code: "${e.errors[0].code}"`);
}

// 4. Test type errors
console.log('\n4. Type error (expected number, got boolean):');
try {
  const schema = z.union([
    z.number(),
    z.string(),
    z.object({}),
    z.array(z.any())
  ]);
  schema.parse(false);
} catch (e) {
  console.log(`Message: "${e.errors[0].message}"`);
  console.log(`Code: "${e.errors[0].code}"`);
}

// 5. Test "Invalid input" cases
console.log('\n5. Complex union with regex (expecting "Invalid input"):');
try {
  const typeSchema = z.union([
    z.string().regex(/^(list\.)?(metaobject_reference|mixed_reference)<(\$app:[a-zA-Z0-9_-]+(,\s*)?)+>$/),
    z.enum([
      'boolean', 'color', 'date_time', 'date', 'dimension', 'json', 'language',
      'list.color', 'list.date_time', 'list.date', 'list.dimension',
      'list.number_decimal', 'list.number_integer', 'list.rating',
      'list.single_line_text_field', 'list.url', 'list.volume', 'list.weight',
      'money', 'multi_line_text_field', 'number_decimal', 'number_integer',
      'rating', 'rich_text_field', 'single_line_text_field', 'url', 'link',
      'list.link', 'volume', 'weight', 'company_reference', 'list.company_reference',
      'customer_reference', 'list.customer_reference', 'product_reference',
      'list.product_reference', 'collection_reference', 'list.collection_reference',
      'variant_reference', 'list.variant_reference', 'file_reference',
      'list.file_reference', 'product_taxonomy_value_reference',
      'list.product_taxonomy_value_reference', 'metaobject_reference',
      'list.metaobject_reference', 'mixed_reference', 'list.mixed_reference',
      'page_reference', 'list.page_reference', 'order_reference',
    ])
  ]);
  typeSchema.parse('year');
} catch (e) {
  console.log(`Message: "${e.errors[0].message}"`);
  console.log(`Code: "${e.errors[0].code}"`);
  console.log('Full error:', JSON.stringify(e.errors, null, 2));
}