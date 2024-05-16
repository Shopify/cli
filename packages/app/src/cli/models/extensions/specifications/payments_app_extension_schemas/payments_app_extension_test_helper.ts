export function buildCheckoutPaymentMethodFields(count: number): {key: string; type: string; required: boolean}[] {
  const fields: {key: string; type: string; required: boolean}[] = []
  for (let i = 0; i < count; i++) {
    fields.push({
      key: `key${i + 1}`,
      type: 'string',
      required: true,
    })
  }
  return fields
}
