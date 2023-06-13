const FLOW_COMMERCE_OBJECT_TYPES = ['customer_id', 'order_id', 'product_id', 'marketing_activity_id', 'abandonment_id']

const serializeFlowFields = (fields?: {[key: string]: unknown}[]) => {
  const serializedFields: {[key: string]: string | number} = {}

  if (!fields) return serializedFields

  fields.forEach((field) => {
    if (typeof field.name !== 'string') return

    if (FLOW_COMMERCE_OBJECT_TYPES.includes(field.name)) {
      const fieldGIDName = field.name.replaceAll('_id', '').replace('_', '')
      serializedFields[field.name] = `gid://shopify/${
        fieldGIDName.charAt(0).toUpperCase() + fieldGIDName.slice(1)
      }/1234567`
    } else {
      serializedFields[field.name] = ''
    }
  })

  return serializedFields
}

export const getTriggerPreview = (uuid: string, fields: {[key: string]: unknown}[]) => {
  return `mutation {
  flowTriggerReceive(
    body: {
      trigger_id: "${uuid}",
      properties: ${JSON.stringify(serializeFlowFields(fields))}
    }
  ) {
    userErrors {
      field
      message
    }
  }
}`.trimStart()
}

export const getActionPreview = (
  title: string,
  hasCustomConfigurationPage: boolean,
  fields?: {[key: string]: unknown}[],
) =>
  JSON.stringify(
    {
      shop_id: 0,
      shopify_domain: 'johns-apparel.myshopify.com',
      action_run_id: 'xxxx-xxxx-xxxx-xxxx',
      action_definition_id: title,
      step_reference: hasCustomConfigurationPage
        ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        : undefined,
      properties: serializeFlowFields(fields),
    },
    null,
    2,
  )
