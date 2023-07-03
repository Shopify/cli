import {examples} from './documentation/examples.js'
import {unstyled} from '../src/public/node/output.js'
import {renderFatalError} from '../src/public/node/ui.js'
import {AbortError} from '../src/public/node/error.js'
import {FunctionDeclaration, JSDocTag, Project} from 'ts-morph'
import difference from 'lodash/difference.js'

async function refreshDocumentation(): Promise<void> {
  const validationErrors: {message: string}[] = []
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
  })
  const sourceFile = project.getSourceFileOrThrow('src/public/node/ui.tsx')
  const renderFunctions = sourceFile.getFunctions().filter((func) => func.getNameOrThrow().startsWith('render'))

  validateMissingExamples(renderFunctions, validationErrors)
  validateMissingDocs(renderFunctions, validationErrors)

  if (validationErrors.length > 0) {
    renderFatalError(
      new AbortError('Refreshing the documentation failed', {
        list: {items: validationErrors.map((error) => error.message)},
      }),
    )
  }

  const exampleTags: {[key: string]: JSDocTag[]} = renderFunctions.reduce((acc, func) => {
    acc[func.getNameOrThrow()] = func
      .getJsDocs()
      .flatMap((jsDoc) => jsDoc.getTags())
      .filter((tag) => tag.getTagName() === 'example')

    return acc
  }, {} as {[key: string]: JSDocTag[]})

  const removeTrailingSpaces = (text: string) => text.replace(/ +(\u001b\[\d+m)?$/gm, '')

  for (const renderFunctionName of Object.keys(exampleTags)) {
    const hasCompleteExample = typeof examples[renderFunctionName]!.complete !== 'undefined'
    // eslint-disable-next-line no-await-in-loop
    const basicExample = await examples[renderFunctionName]!.basic()
    const tags = [
      {
        tagName: 'example',
        text: unstyled(`${hasCompleteExample ? 'Basic' : ''}\n${removeTrailingSpaces(basicExample)}`),
      },
    ]

    if (hasCompleteExample) {
      // eslint-disable-next-line no-await-in-loop
      const completeExample = await examples[renderFunctionName]!.complete!()
      tags.push({
        tagName: 'example',
        text: unstyled(`Complete\n${removeTrailingSpaces(completeExample)}`),
      })
    }

    const functionJsDoc = renderFunctions.find((func) => func.getNameOrThrow() === renderFunctionName)!.getJsDocs()[0]!

    functionJsDoc
      .getTags()
      .filter((tag) => tag.getTagName() === 'example')
      .forEach((tag) => tag.remove())

    functionJsDoc.addTags(tags)
  }

  await project.save()
}

function validateMissingExamples(renderFunctions: FunctionDeclaration[], validationErrors: {message: string}[]): void {
  const renderFunctionNames = renderFunctions.map((func) => func.getNameOrThrow())

  difference(renderFunctionNames, Object.keys(examples)).forEach((name) => {
    validationErrors.push({message: `${name} function must have at least a basic example defined in the examples file`})
  })
}

function validateMissingDocs(renderFunctions: FunctionDeclaration[], validationErrors: {message: string}[]): void {
  renderFunctions.forEach((renderFunction) => {
    const jsDocs = renderFunction.getJsDocs()
    const name = renderFunction.getNameOrThrow()

    if (jsDocs.length === 0) {
      validationErrors.push({message: `${name} function must have jsdocs`})
    }
  })
}

refreshDocumentation()
  .then(() => {
    process.exit(0)
  })
  // eslint-disable-next-line node/handle-callback-err
  .catch((_error) => {
    process.exit(1)
  })
