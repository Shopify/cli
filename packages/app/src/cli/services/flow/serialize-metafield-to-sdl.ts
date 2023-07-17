import {FlowReturnSchema, FieldSchema, FlowReturnObject} from '../../models/extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {capitalize, camelize} from '@shopify/cli-kit/common/string'

export const getFieldType = (field: zod.infer<typeof FieldSchema>, objectKey: string) => {
  let choices
  if (field.validations) {
    const validation = field.validations.find((validation) => validation.choices)
    if (validation) {
      choices = validation.choices
    }
  }

  let fieldType
  let enumType
  if (field.type.includes('<') && field.type.includes('>')) {
    const itemType = capitalize(field.type.slice(field.type.indexOf('<') + 1, field.type.indexOf('>')))
    fieldType = field.type.startsWith('list.') ? `[${itemType}]` : itemType
  } else if (field.type.startsWith('list.')) {
    const itemType = field.type.slice(field.type.indexOf('.') + 1)
    if (['number_decimal', 'number_integer'].includes(itemType)) {
      fieldType = '[Int]'
    } else if (itemType === 'single_line_text_field') {
      if (choices && field.key) {
        fieldType = `[${capitalize(camelize(objectKey))}${capitalize(camelize(field.key))}Enum]`
        enumType = `enum ${fieldType.slice(1, -1)} {\n  ${choices.join('\n  ')}\n}`
      } else {
        fieldType = '[String]'
      }
    } else {
      fieldType = `[${capitalize(itemType)}]`
    }
  } else if (field.type === 'number_decimal' || field.type === 'number_integer') {
    fieldType = 'Int'
  } else if (field.type === 'single_line_text_field') {
    if (choices && field.key) {
      fieldType = `${capitalize(camelize(objectKey))}${capitalize(camelize(field.key))}Enum`
      enumType = `enum ${fieldType} {\n  ${choices.join('\n  ')}\n}`
    } else {
      fieldType = 'String'
    }
  } else {
    fieldType = capitalize(field.type)
  }

  fieldType = field.required ? `${fieldType}!` : fieldType

  return {fieldType, enumType}
}

export const generateGraphQLField = (field: zod.infer<typeof FieldSchema>, objectKey: string) => {
  const {fieldType} = getFieldType(field, objectKey)
  let fieldSDL = ''
  if (field.description) {
    fieldSDL += `  # ${field.description}\n`
  }
  if (field.key) {
    fieldSDL += `  ${field.key}: ${fieldType}\n`
  }
  return fieldSDL
}

export const generateGraphQLType = (object: zod.infer<typeof FlowReturnObject>) => {
  let typeSDL = ''
  let enumSDL = ''
  if (object.description) {
    typeSDL += `# ${object.description}\n`
  }
  if (object.key) {
    typeSDL += `type ${capitalize(camelize(object.key))} {\n`
    if (object.fields) {
      object.fields.forEach((field) => {
        const {enumType} = getFieldType(field, object.key)
        if (enumType) {
          enumSDL += `${enumType}\n`
        }
        typeSDL += generateGraphQLField(field, object.key)
      })
    }
    typeSDL += '}\n'
  }
  return {typeSDL, enumSDL}
}

export const loadSchemaPatchFromReturns = (returns: zod.infer<typeof FlowReturnSchema>) => {
  let graphqlSDL = ''
  let enumSDL = ''

  if (!returns || !returns.objects) {
    return graphqlSDL
  }

  returns.objects.forEach((object) => {
    const {typeSDL, enumSDL: objectEnumSDL} = generateGraphQLType(object)
    graphqlSDL += typeSDL
    enumSDL += objectEnumSDL
  })

  return graphqlSDL + enumSDL
}
