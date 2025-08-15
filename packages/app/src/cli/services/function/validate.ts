import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {validateShopifyFunctionPackageVersion} from './build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {Readable, Writable} from 'stream'
import {
  GraphQLSchema,
  DocumentNode,
  validate,
  parse,
  buildSchema,
  OperationDefinitionNode,
  SelectionSetNode,
} from 'graphql'
import fs from 'fs/promises'

export async function validateFixtures(
  schema: GraphQLSchema,
  inputQueryPath: string,
  ourFunction: ExtensionInstance<FunctionConfigType>,
) {
  const errors: any[] = []

  console.log('VALIDATING INPUT QUERY AGAINST SCHEMA')
  // Validate that the input query is valid against the local schema
  const inputQueryString = await fs.readFile(inputQueryPath, 'utf8')
  const inputQueryAST = parse(inputQueryString)
  validateInputQuery(schema, inputQueryAST) // works
  console.log('--------------------------------')

  // Validate that the output fixture is valid against the local schema
  console.log('VALIDATING OUTPUT FIXTURE AGAINST SCHEMA')
  const outputFixturePath = `${ourFunction?.directory}/test/fixtures/output.json`
  const outputFixtureString = await fs.readFile(outputFixturePath, 'utf8')
  const outputFixtureObject = JSON.parse(outputFixtureString)
  console.log('Output fixture path', outputFixturePath)
  console.log(validateJSONAgainstGraphQLType(schema, outputFixtureObject, 'CartValidationsGenerateRunResult'))
  console.log('--------------------------------')

  console.log('*** VALID INPUT FIXTURE')
  const validInputFixturePath = `${ourFunction?.directory}/test/fixtures/input_valid.json`
  const validInputFixtureString = await fs.readFile(validInputFixturePath, 'utf8')
  const validInputFixtureObject = JSON.parse(validInputFixtureString)
  console.log('Input fixture path', validInputFixturePath)
  console.log()
  console.log(validateJSONAgainstGraphQLType(schema, validInputFixtureObject, 'Input'))
  const validInputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(validInputFixtureObject, inputQueryString)
  console.log(validInputFixtureShapeMatchesQuery)
  console.log('--------------------------------')

  console.log('*** INVALID SHAPE INPUT FIXTURE')
  const invalidShapeInputFixturePath = `${ourFunction?.directory}/test/fixtures/input_invalid_shape.json`
  const invalidShapeInputFixtureString = await fs.readFile(invalidShapeInputFixturePath, 'utf8')
  const invalidShapeInputFixtureObject = JSON.parse(invalidShapeInputFixtureString)
  console.log('Input fixture path', invalidShapeInputFixturePath)
  console.log()
  console.log(validateJSONAgainstGraphQLType(schema, invalidShapeInputFixtureObject, 'Input'))
  const invalidShapeInputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(
    invalidShapeInputFixtureObject,
    inputQueryString,
  )
  console.log(invalidShapeInputFixtureShapeMatchesQuery)
  console.log('--------------------------------')

  console.log('*** INVALID VALUE INPUT FIXTURE')
  const invalidValueInputFixturePath = `${ourFunction?.directory}/test/fixtures/input_invalid_value.json`
  const invalidValueInputFixtureString = await fs.readFile(invalidValueInputFixturePath, 'utf8')
  const invalidValueInputFixtureObject = JSON.parse(invalidValueInputFixtureString)
  console.log('Input fixture path', invalidValueInputFixturePath)
  console.log()
  console.log(validateJSONAgainstGraphQLType(schema, invalidValueInputFixtureObject, 'Input'))
  const invalidValueInputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(
    invalidValueInputFixtureObject,
    inputQueryString,
  )
  console.log(invalidValueInputFixtureShapeMatchesQuery)
  console.log('--------------------------------')

  console.log('*** CUSTOM INVALID INPUT FIXTURE')
  const customInvalidInputFixturePath = `${ourFunction?.directory}/test/fixtures/input_custom_invalid.json`
  const customInvalidInputFixtureString = await fs.readFile(customInvalidInputFixturePath, 'utf8')
  const customInvalidInputFixtureObject = JSON.parse(customInvalidInputFixtureString)
  console.log('Input fixture path', customInvalidInputFixturePath)
  console.log()
  console.log(validateJSONAgainstGraphQLType(schema, customInvalidInputFixtureObject, 'Input'))
  const customInvalidInputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(
    customInvalidInputFixtureObject,
    inputQueryString,
  )
  console.log(customInvalidInputFixtureShapeMatchesQuery)
  console.log('--------------------------------')

  // // Validate that the input fixture is valid against the local schema
  // console.log('INVALID INPUT SHAPE FIXTURE')
  // const inputFixturePathInvalid = `${ourFunction?.directory}/test/fixtures/input_invalid_shape.json`
  // const inputFixtureStringInvalid = await fs.readFile(inputFixturePathInvalid, 'utf8')
  // const inputFixtureObjectInvalid = JSON.parse(inputFixtureStringInvalid)
  // console.log('Input fixture path', inputFixturePathInvalid)
  // console.log(validateJSONAgainstGraphQLType(schema, inputFixtureObjectInvalid, 'Input'))
  // console.log('--------------------------------')

  // // Validate that the output fixture is valid against the local schema
  // const outputFixturePath = `${ourFunction?.directory}/test/fixtures/output.json`
  // const outputFixtureString = await fs.readFile(outputFixturePath, 'utf8')
  // const outputFixtureObject = JSON.parse(outputFixtureString)
  // console.log('Output fixture path', outputFixturePath)
  // console.log(validateJSONAgainstGraphQLType(schema, outputFixtureObject, 'CartValidationsGenerateRunResult'))

  // const inputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(inputFixtureObject, inputQueryString)
  // console.log('inputFixtureShapeMatchesQuery', inputFixtureShapeMatchesQuery)

  // const inputFixtureObject = convertFixtureObject(inputFixtureString)
  // const inputFixtureAST = parse(inputFixtureString)

  // console.log('inputFixtureAST', inputFixtureAST)
  // errors.push(validateFixture(schema, inputFixtureAST))

  // // Validate that the output fixture is valid against the local schema
  // const outputFixturePath = `${ourFunction?.directory}/test/fixtures/output.json`
  // const outputFixtureString = await fs.readFile(outputFixturePath, 'utf8')
  // const outputFixtureAST = parse(outputFixtureString)
  // errors.push(validateFixture(schema, outputFixtureAST))

  // Validate that the input query and input fixture are valid against each other

  return errors
}

export function validateInputQuery(schema: GraphQLSchema, inputQueryAST: DocumentNode) {
  console.log('>> Validating input query against schema')
  const validationErrors = validate(schema, inputQueryAST)
  if (validationErrors.length > 0) {
    console.error('Validation errors:', validationErrors)
  } else {
    console.log('Validation successful')
  }
  return validationErrors
}

export function validateJSONAgainstGraphQLType(schema: GraphQLSchema, json: any, typeName: string) {
  console.log('>> Validating JSON fixture against schema')
  const graphqlType = schema.getType(typeName)

  if (!graphqlType) {
    return {
      valid: false,
      errors: [`Type '${typeName}' not found in schema`],
      typeName,
      typeDefinition: '',
    }
  }

  function validateValue(value: any, type: any, path = '') {
    const errors: any[] = []

    // Handle NonNull wrapper
    if (type.toString().endsWith('!')) {
      const wrappedType = type.ofType
      if (value === null || value === undefined) {
        errors.push(`Field at '${path}' is required but got null/undefined`)
        return errors
      }
      return validateValue(value, wrappedType, path)
    }

    // Handle List wrapper
    if (type.toString().startsWith('[')) {
      const wrappedType = type.ofType
      if (!Array.isArray(value)) {
        errors.push(`Field at '${path}' expected array but got ${typeof value}`)
        return errors
      }

      value.forEach((item, index) => {
        const itemErrors = validateValue(item, wrappedType, `${path}[${index}]`)
        errors.push(...itemErrors)
      })

      return errors
    }

    // Handle null values for nullable types
    if (value === null || value === undefined) {
      return errors // Nullable field, null is OK
    }

    // Handle scalar types
    const scalarTypeMap: Record<string, string> = {
      String: 'string',
      ID: 'string',
      Int: 'number',
      Float: 'number',
      Boolean: 'boolean',
    }

    const expectedJSType = scalarTypeMap[type.name]
    if (expectedJSType) {
      if (type.name === 'Int' && typeof value === 'number' && !Number.isInteger(value)) {
        errors.push(`Field at '${path}' expected Int but got non-integer number`)
      } else if (typeof value !== expectedJSType) {
        errors.push(`Field at '${path}' expected ${type.name} but got ${typeof value}`)
      }
    } else {
      // Handle object types
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`Field at '${path}' expected object but got ${typeof value}`)
        return errors
      }

      const typeFields = type.getFields()

      // Only validate fields that exist in the fixture
      Object.keys(value).forEach((fieldName) => {
        const fieldPath = path ? `${path}.${fieldName}` : fieldName

        if (fieldName in typeFields) {
          const fieldDef = typeFields[fieldName]
          const fieldType = fieldDef.type
          const fieldErrors = validateValue(value[fieldName], fieldType, fieldPath)
          errors.push(...fieldErrors)
        }
      })

      // Check for unexpected fields
      Object.keys(value).forEach((key) => {
        if (!(key in typeFields)) {
          const fieldPath = path ? `${path}.${key}` : key
          errors.push(`Unexpected field '${fieldPath}' not defined in type '${type.name}'`)
        }
      })
    }

    return errors
  }

  const errors = validateValue(json, graphqlType)

  return {
    valid: errors.length === 0,
    errors,
    typeName,
    typeDefinition: graphqlType.toString(),
  }
}

// Validate that fixture shape matches GraphQL query shape
export function validateFixtureShapeMatchesQuery(
  fixture: any,
  queryString: string,
): {
  valid: boolean
  errors: string[]
  missingInFixture: string[]
  extraInFixture: string[]
} {
  try {
    console.log('>> Validating JSON fixture against Input Query')
    const queryAST = parse(queryString)
    const operation = queryAST.definitions.find((def) => def.kind === 'OperationDefinition') as OperationDefinitionNode

    if (!operation) {
      return {
        valid: false,
        errors: ['No operation definition found in query'],
        missingInFixture: [],
        extraInFixture: [],
      }
    }

    const errors: string[] = []
    const missingInFixture: string[] = []
    const extraInFixture: string[] = []

    function extractQueryShape(selectionSet: SelectionSetNode, path = ''): Record<string, any> {
      const shape: Record<string, any> = {}

      if (!selectionSet || !selectionSet.selections) {
        return shape
      }

      selectionSet.selections.forEach((selection) => {
        if (selection.kind === 'Field') {
          const fieldName = selection.name.value
          const fieldPath = path ? `${path}.${fieldName}` : fieldName

          if (selection.selectionSet) {
            // Field has nested selections (object/array)
            shape[fieldName] = extractQueryShape(selection.selectionSet, fieldPath)
          } else {
            // Leaf field (scalar)
            shape[fieldName] = null
          }
        }
      })

      return shape
    }

    function compareShapes(queryShape: Record<string, any>, fixtureData: any, path = ''): void {
      // Check for missing fields in fixture
      Object.keys(queryShape).forEach((field) => {
        const fieldPath = path ? `${path}.${field}` : field

        if (!(field in fixtureData)) {
          missingInFixture.push(`Field '${fieldPath}' required by query but missing in fixture`)
          return
        }

        const queryValue = queryShape[field]
        const fixtureValue = fixtureData[field]

        if (queryValue === null) {
          // Leaf field - just check it exists (we already did above)
          return
        }

        // Object field
        if (typeof queryValue === 'object' && queryValue !== null) {
          if (Array.isArray(fixtureValue)) {
            // Query expects object, fixture has array
            if (fixtureValue.length === 0) {
              errors.push(`Array at '${fieldPath}' is empty in fixture`)
              return
            }
            // Compare query shape with first array item
            compareShapes(queryValue, fixtureValue[0], `${fieldPath}[0]`)
          } else if (typeof fixtureValue === 'object' && fixtureValue !== null) {
            // Both are objects, compare recursively
            compareShapes(queryValue, fixtureValue, fieldPath)
          } else {
            errors.push(`Field '${fieldPath}' expected object but fixture has ${typeof fixtureValue}`)
          }
        }
      })

      // Check for extra fields in fixture
      if (typeof fixtureData === 'object' && !Array.isArray(fixtureData)) {
        Object.keys(fixtureData).forEach((field) => {
          if (!(field in queryShape)) {
            const fieldPath = path ? `${path}.${field}` : field
            extraInFixture.push(`Field '${fieldPath}' exists in fixture but not requested in query`)
          }
        })
      }
    }

    const queryShape = extractQueryShape(operation.selectionSet)
    compareShapes(queryShape, fixture)

    return {
      valid: errors.length === 0 && missingInFixture.length === 0 && extraInFixture.length === 0,
      errors,
      missingInFixture,
      extraInFixture,
    }
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Failed to parse query: ${error.message}`],
      missingInFixture: [],
      extraInFixture: [],
    }
  }
}
