import {
  GraphQLSchema,
  DocumentNode,
  validate,
  parse,
  OperationDefinitionNode,
  SelectionSetNode,
  buildSchema,
} from 'graphql'
import fs from 'fs/promises'
import path from 'path'

export async function validateFixtures(fixture: any, schemaPath: string) {
  const errors: any[] = []

  console.log('VALIDATING INPUT QUERY AGAINST SCHEMA')
  const testsDir = __dirname // /path/to/function/tests/helpers
  const functionDir = path.dirname(path.dirname(testsDir)) // /path/to/function
  const inputQueryPath = path.join(functionDir, fixture.query) // /path/to/function/src/run.graphql
  const inputQueryString = await fs.readFile(inputQueryPath, 'utf8')
  const inputQueryAST = parse(inputQueryString)
  const schemaString = await fs.readFile(schemaPath, 'utf8')
  const schema = buildSchema(schemaString)
  validateInputQuery(schema, inputQueryAST) // works
  console.log('--------------------------------')

  console.log('VALIDATING OUTPUT FIXTURE AGAINST SCHEMA')
  const outputFixtureObject = fixture.expectedOutput

  let resultTypeName = 'Unknown'
  if (fixture.target) {
    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf8')
      const targetParts = fixture.target.split('.')
      const operationName = targetParts[targetParts.length - 1] // "run"
      let mutationMatch = null

      const exactPattern = `"""\\s*Handles the Function result for the ${fixture.target.replace(/\./g, '\\.')} target\\.\\s*"""\\s*${operationName}\\s*\\(\\s*[^)]*result:\\s*(\\w+)!`
      mutationMatch = schemaContent.match(new RegExp(exactPattern, 's'))

      if (mutationMatch && mutationMatch[1]) {
        resultTypeName = mutationMatch[1]
      } else {
        const operationPattern = `${operationName}\\s*\\(\\s*[^)]*result:\\s*(\\w+)!`
        mutationMatch = schemaContent.match(new RegExp(operationPattern, 's'))

        if (mutationMatch && mutationMatch[1]) {
          resultTypeName = mutationMatch[1]
        } else {
          const simplePattern = `${operationName}\\s*\\(`
          const simpleMatch = schemaContent.match(new RegExp(simplePattern, 's'))

          if (simpleMatch) {
            console.log('Found mutation field with operation name but couldn\'t extract result type')
          }

          console.warn(`Could not find result type for target: ${fixture.target}, skipping output validation`)
        }
      }
    } catch (error) {
      console.warn(`Error parsing schema for result type: ${error}, skipping output validation`)
    }
  } else {
    console.warn('No target found in fixture, skipping output validation')
  }

  // Only validate output if we found a valid result type
  if (resultTypeName !== 'Unknown') {
    console.log(validateJSONAgainstGraphQLType(schema, outputFixtureObject, resultTypeName))
  } else {
    console.log('Skipping output validation - result type could not be determined')
  }
  console.log('--------------------------------')

  console.log('VALIDATING INPUT FIXTURE AGAINST QUERY')
  const validInputFixtureObject = fixture.input
  console.log(validateJSONAgainstGraphQLType(schema, validInputFixtureObject, 'Input'))
  const validInputFixtureShapeMatchesQuery = validateFixtureShapeMatchesQuery(validInputFixtureObject, inputQueryString)
  console.log(validInputFixtureShapeMatchesQuery)
  console.log('--------------------------------')

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
