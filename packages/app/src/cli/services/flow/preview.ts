import {FLOW_EXTENSION_TYPES, FLOW_COMMERCE_OBJECT_TYPES} from './constants.js'
import fs from 'fs'

const getFlowTriggerPreview = (triggerId: string, fields: {[key: string]: string | number}) =>
  `
mutation {
  flowTriggerReceive(
    body: {
      trigger_id: "${triggerId}",
      properties: ${JSON.stringify(fields)}
    }
  ) {
    userErrors {
      field
      message
    }
  }
}`.trimStart()

const serializeFields = (fields: {[key: string]: string}[]) => {
  const serializedFields: {[key: string]: string | number} = {}

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

export const produceFlowExtensionPreview = ({
  uuid,
  type,
  outputPath,
  configValue,
}: {
  uuid: string
  type: string
  outputPath: string
  configValue?: {[key: string]: unknown}
}) => {
  if (!FLOW_EXTENSION_TYPES.includes(type)) {
    return
  }

  if (!configValue) {
    return
  }

  let flowExtensionPreviewDestination = ''
  let preview = ''
  const fields = (configValue.fields as {[key: string]: string}[]) || []

  if (type === 'flow_trigger') {
    flowExtensionPreviewDestination = 'payloadPreview.gql'
    preview = getFlowTriggerPreview(uuid, serializeFields(fields))
  }

  if (type === 'flow_action') {
    flowExtensionPreviewDestination = 'payloadPreview.json'
    preview = JSON.stringify(
      {
        shop_id: 0,
        shopify_domain: 'johns-apparel.myshopify.com',
        action_run_id: 'xxxx-xxxx-xxxx-xxxx',
        action_definition_id: configValue?.title,
        step_reference: configValue.custom_configuration_page_url
          ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
          : undefined,
        properties: serializeFields(fields),
      },
      null,
      2,
    )
  }

  fs.writeFileSync(`${outputPath}/${flowExtensionPreviewDestination}`, preview)
}
