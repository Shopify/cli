import {shopifyFunctionCodegenDefaults} from './build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {loadTypeScript} from '../../models/extensions/specifications/type-generation.js'
import {camelize} from '@shopify/cli-kit/common/string'
import {findPathUp, readFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, moduleDirectory, relativizePath} from '@shopify/cli-kit/node/path'
// The function's schema is SDL, not introspection JSON
// eslint-disable-next-line @shopify/typescript-prefer-build-client-schema
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLNamedInputType,
  GraphQLNonNull,
  GraphQLScalarType,
  Kind,
  OperationDefinitionNode,
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  parse,
  typeFromAST,
} from 'graphql'
import type ts from 'typescript'

const builtinScalars: {[name: string]: string} = {Int: 'number', Float: 'number', String: 'string', Boolean: 'boolean'}
const codegenScalars: {[name: string]: string} = shopifyFunctionCodegenDefaults.scalars

// The TypeScript type codegen gives a scalar, so `unknown` ones (like `JSON`) accept anything.
const scalarKind = (named: GraphQLNamedInputType) =>
  builtinScalars[named.name] ?? codegenScalars[named.name] ?? shopifyFunctionCodegenDefaults.defaultScalarType

/**
 * Checks what each `prepare` export returns against the variables its run target's input query declares. Type
 * annotations and casts are ignored, values are followed back to where they're created, and anything that can't be
 * followed is an error rather than a pass.
 */
export async function prepareVariablesErrors(fun: ExtensionInstance<FunctionConfigType>): Promise<string[]> {
  const targets = fun.configuration.targeting ?? []
  const pairs = targets.flatMap(({target, export: name}) => {
    const run = targets.find((other) => other.target === target.replace(/\.prepare$/, '.run'))
    return target.endsWith('.prepare') && name && run?.input_query
      ? [{name: camelize(name), query: run.input_query}]
      : []
  })
  if (pairs.length === 0) return []

  const [schemaSource, ...querySources] = await Promise.all(
    ['schema.graphql', ...pairs.map(({query}) => query)].map((path) => readFile(joinPath(fun.directory, path))),
  )
  const schema = buildSchema(schemaSource!)
  const ts = await loadTypeScript()
  const options: ts.CompilerOptions = {
    allowJs: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    lib: ['lib.es2022.d.ts'],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  // The bundled CLI ships TypeScript's standard library as an asset, since it isn't beside the bundled compiler
  const libraries =
    (await findPathUp('assets/typescript', {type: 'directory', cwd: moduleDirectory(import.meta.url)})) ??
    dirname(ts.getDefaultLibFilePath(options))
  const host = ts.createCompilerHost(options, true)
  host.getDefaultLibLocation = () => libraries
  // Annotations and casts are claims nothing checks against the value (`@ts-ignore` silences the compiler), so they're
  // blanked out of the function's own files, leaving types to come from the values. Parameter types are kept. Blanking
  // keeps positions, so errors point at the original source.
  const {getSourceFile} = host
  host.getSourceFile = (fileName, language, ...rest) => {
    const file = getSourceFile(fileName, language, ...rest)
    if (!file || file.isDeclarationFile || fileName.includes('/node_modules/')) return file
    const text = file.text.split('')
    const blank = (start: number, end: number) => {
      for (let index = start; index < end; index++) if (text[index] !== '\n' && text[index] !== '\r') text[index] = ' '
    }
    const visit = (node: ts.Node): void => {
      for (const tag of ts.getJSDocTags(node)) {
        const typing =
          ts.isJSDocTypeTag(tag) ||
          ts.isJSDocReturnTag(tag) ||
          ts.isJSDocSatisfiesTag(tag) ||
          ts.isJSDocOverloadTag(tag)
        if (typing && !ts.isParameter(tag.parent.parent)) blank(tag.pos, tag.end)
      }
      if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) {
        blank(node.expression.end, node.end)
      } else if (ts.isTypeAssertionExpression(node)) {
        blank(node.type.pos - 1, node.expression.pos)
      } else if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.typeArguments) {
        blank(node.typeArguments.pos - 1, node.typeArguments.end + 1)
      } else if (
        (ts.isVariableDeclaration(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isGetAccessorDeclaration(node)) &&
        node.type
      ) {
        blank(node.type.pos - 1, node.type.end)
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    return ts.createSourceFile(fileName, text.join(''), language)
  }
  const program = ts.createProgram([fun.entrySourceFilePath], options, host)
  const checker = program.getTypeChecker()
  const entryFile = program.getSourceFile(fun.entrySourceFilePath)
  const entry = entryFile && checker.getSymbolAtLocation(entryFile)
  const errors = new Set<string>()

  const report = (node: ts.Node, message: string) => {
    const file = node.getSourceFile()
    const {line, character} = file.getLineAndCharacterOfPosition(node.getStart())
    errors.add(`${relativizePath(file.fileName, fun.directory)}:${line + 1}:${character + 1} ${message}`)
  }
  const join = (path: string, key: string) => (path ? `${path}.${key}` : key)
  const subject = (path: string) => (path ? `\`${path}\`` : 'The result')
  const unchecked = (type: ts.Type) => Boolean(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))

  const unwrap = (node: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node

  const functionOf = (node: ts.Node | undefined): ts.FunctionLikeDeclaration | undefined => {
    if (!node) return
    if (ts.isVariableDeclaration(node)) return node.initializer && functionOf(unwrap(node.initializer))
    const local =
      !node.getSourceFile().isDeclarationFile && !program.isSourceFileFromExternalLibrary(node.getSourceFile())
    if (local && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
      return node.body && node
    }
  }

  const symbolOf = (node: ts.Identifier) =>
    ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node)

  // A reference that could change the value after it's created: assigning to it or a member, deleting or
  // incrementing a member, calling a method on it, or passing, aliasing or reassigning the binding itself.
  const changes = (reference: ts.Identifier) => {
    let top: ts.Node = reference
    while (
      (ts.isPropertyAccessExpression(top.parent) || ts.isElementAccessExpression(top.parent)) &&
      top.parent.expression === top
    ) {
      top = top.parent
    }
    const {parent} = top
    if (top === reference) {
      return !(ts.isSpreadAssignment(parent) || ts.isSpreadElement(parent) || ts.isTypeOfExpression(parent))
    }
    return (
      (ts.isBinaryExpression(parent) &&
        parent.left === top &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ts.isDeleteExpression(parent) ||
      ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
      (ts.isCallExpression(parent) && parent.expression === top)
    )
  }

  for (const [index, {name, query}] of pairs.entries()) {
    const operation = parse(querySources[index]!).definitions.find(
      (definition): definition is OperationDefinitionNode => definition.kind === Kind.OPERATION_DEFINITION,
    )
    const variables = new GraphQLInputObjectType({
      name: 'Variables',
      fields: Object.fromEntries(
        (operation?.variableDefinitions ?? []).map((definition) => [
          definition.variable.name.value,
          {type: typeFromAST(schema, definition.type) as GraphQLInputType, defaultValue: definition.defaultValue},
        ]),
      ),
    })
    const result = new GraphQLInputObjectType({
      name: 'PrepareResult',
      fields: {variables: {type: new GraphQLNonNull(variables)}},
    })
    const owner = (type: GraphQLInputObjectType) =>
      type === variables ? `declared by ${query}` : `a field of ${type.name}`
    const followed = new Map<ts.VariableDeclaration, string>()
    const checkedReferences = new Set<ts.Node>()
    const visiting = new Set<ts.Node>()

    const scalarMatches = (type: ts.Type, named: GraphQLScalarType | GraphQLEnumType) => {
      if (isEnumType(named)) return type.isStringLiteral() && named.getValue(type.value) !== undefined
      switch (scalarKind(named)) {
        case 'string':
          return Boolean(type.flags & ts.TypeFlags.StringLike)
        case 'number':
          return (
            Boolean(type.flags & ts.TypeFlags.NumberLike) &&
            !(named.name === 'Int' && type.isNumberLiteral() && !Number.isInteger(type.value))
          )
        case 'boolean':
          return Boolean(type.flags & ts.TypeFlags.BooleanLike)
        default:
          return false
      }
    }

    const typed = (
      type: ts.Type,
      expected: GraphQLInputType,
      path: string,
      omittable: boolean,
      node: ts.Node,
    ): void => {
      const named = getNamedType(expected)
      if (!isEnumType(named) && !isInputObjectType(named) && scalarKind(named) === 'unknown') return
      if (unchecked(type))
        return report(node, `${subject(path)} is typed ${checker.typeToString(type)}, so it can't be checked`)
      if (type.isUnion()) return type.types.forEach((member) => typed(member, expected, path, omittable, node))
      if (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
        if (isNonNullType(expected) && !omittable)
          report(node, `${subject(path)} can be undefined, but ${expected} has no default`)
        return
      }
      if (type.flags & ts.TypeFlags.Null) {
        if (isNonNullType(expected)) report(node, `${subject(path)} can be null, but ${expected} can't`)
        return
      }
      const inner = isNonNullType(expected) ? expected.ofType : expected
      if (isListType(inner)) {
        const element =
          (checker.isArrayType(type) || checker.isTupleType(type)) &&
          checker.getIndexTypeOfType(type, ts.IndexKind.Number)
        return element
          ? typed(element, inner.ofType, `${path}[]`, false, node)
          : typed(type, inner.ofType, path, false, node)
      }
      if (isInputObjectType(inner) && type.flags & ts.TypeFlags.Object && !checker.isArrayType(type)) {
        if (checker.getIndexInfosOfType(type).length > 0) {
          return report(node, `${subject(path)} can have any keys, so it can't be checked`)
        }
        const fields = inner.getFields()
        for (const property of checker.getPropertiesOfType(type)) {
          const field = fields[property.name]
          const key = join(path, property.name)
          // A property written in an object literal is followed to its value, keeping literal types (like an enum
          // value) that the object's type widens
          const declaration = property.valueDeclaration
          const assignment =
            declaration && (ts.isPropertyAssignment(declaration) || ts.isShorthandPropertyAssignment(declaration))
              ? declaration
              : undefined
          if (!field) {
            report(assignment ?? node, `${subject(key)} isn't ${owner(inner)}`)
          } else if (assignment) {
            const binding = assignment.parent.parent
            if (ts.isVariableDeclaration(binding) && ts.isIdentifier(binding.name)) followed.set(binding, path)
            const initializer = ts.isPropertyAssignment(assignment) ? assignment.initializer : assignment.name
            value(initializer, field.type, key, field.defaultValue !== undefined)
          } else {
            typed(checker.getTypeOfSymbol(property), field.type, key, field.defaultValue !== undefined, node)
          }
        }
        for (const [key, field] of Object.entries(fields)) {
          if (isNonNullType(field.type) && field.defaultValue === undefined && !checker.getPropertyOfType(type, key)) {
            report(node, `${subject(join(path, key))} is missing, and ${field.type} has no default`)
          }
        }
        return
      }
      if (isInputObjectType(inner) || !scalarMatches(type, inner)) {
        report(node, `${subject(path)} must be ${expected}, not ${checker.typeToString(type)}`)
      }
    }

    const returns = (fn: ts.FunctionLikeDeclaration, expected: GraphQLInputType, path: string, omittable: boolean) => {
      const body = fn.body
      if (!body) return
      if (!ts.isBlock(body)) return value(body, expected, path, omittable)
      const visit = (node: ts.Node): void => {
        if (ts.isReturnStatement(node)) {
          if (node.expression) value(node.expression, expected, path, omittable)
          else typed(checker.getUndefinedType(), expected, path, omittable, node)
        } else if (!ts.isFunctionLike(node)) {
          ts.forEachChild(node, visit)
        }
      }
      ts.forEachChild(body, visit)
    }

    const value = (node: ts.Expression, expected: GraphQLInputType, path: string, omittable: boolean): void => {
      const expression = unwrap(node)
      const inner = isNonNullType(expected) ? expected.ofType : expected

      if (ts.isIdentifier(expression)) {
        const declaration = symbolOf(expression)?.valueDeclaration
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
          followed.set(declaration, path)
          checkedReferences.add(expression)
          return value(declaration.initializer, expected, path, omittable)
        }
      } else if (ts.isConditionalExpression(expression)) {
        value(expression.whenTrue, expected, path, omittable)
        return value(expression.whenFalse, expected, path, omittable)
      } else if (
        ts.isBinaryExpression(expression) &&
        (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          expression.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        const left = checker.getNonNullableType(checker.getTypeAtLocation(expression.left))
        typed(left, expected, path, omittable, expression.left)
        return value(expression.right, expected, path, omittable)
      } else if (ts.isCallExpression(expression)) {
        const fn = functionOf(checker.getResolvedSignature(expression)?.declaration)
        if (fn && !visiting.has(fn)) {
          visiting.add(fn)
          returns(fn, expected, path, omittable)
          visiting.delete(fn)
          return
        }
      } else if (ts.isArrayLiteralExpression(expression) && isListType(inner)) {
        for (const element of expression.elements) {
          if (ts.isSpreadElement(element)) typed(checker.getTypeAtLocation(element), expected, path, omittable, element)
          else value(element, inner.ofType, `${path}[]`, false)
        }
        return
      }
      typed(checker.getTypeAtLocation(expression), expected, path, omittable, expression)
    }

    const exported = entry && checker.getExportsOfModule(entry).find((symbol) => symbol.name === name)
    const resolved = exported && (exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported)
    const fn = functionOf(resolved?.valueDeclaration)
    if (!fn) {
      errors.add(`${relativizePath(fun.entrySourceFilePath, fun.directory)} has no \`${name}\` function to check`)
      continue
    }
    returns(fn, new GraphQLNonNull(result), '', false)

    for (const [declaration, path] of followed) {
      const symbol = checker.getSymbolAtLocation(declaration.name)
      const visit = (node: ts.Node): void => {
        if (
          ts.isIdentifier(node) &&
          node !== declaration.name &&
          !checkedReferences.has(node) &&
          symbolOf(node) === symbol &&
          changes(node)
        ) {
          report(node, `${subject(path)} is changed or passed on after it's created, so it can't be checked`)
        }
        ts.forEachChild(node, visit)
      }
      visit(declaration.getSourceFile())
    }
  }

  return [...errors]
}
