import {examples} from './examples.js'
import {unstyled} from '../../../public/node/output.js'
import {JSDocTag, Project} from 'ts-morph'
import isEqual from 'lodash/isEqual.js'

try {
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
  })
  const sourceFile = project.getSourceFileOrThrow('src/public/node/ui.tsx')
  const renderFunctions = sourceFile.getFunctions().filter((func) => func.getNameOrThrow().startsWith('render'))
  const renderFunctionNames = renderFunctions.map((func) => func.getNameOrThrow())

  if (!isEqual(renderFunctionNames, Object.keys(examples))) {
    throw new Error('Every render function must have at least a basic example defined in this file')
  }

  const renderFunctionJsDocs = renderFunctions.map((func) => func.getJsDocs())

  renderFunctionJsDocs.forEach((jsDocs) => {
    if (jsDocs.length === 0) {
      throw new Error('Every render function must have jsdocs')
    }
  })

  const exampleTags: {[key: string]: JSDocTag[]} = renderFunctions.reduce((acc, func) => {
    acc[func.getNameOrThrow()] = func
      .getJsDocs()
      .flatMap((jsDoc) => jsDoc.getTags())
      .filter((tag) => tag.getTagName() === 'example')

    return acc
  }, {} as {[key: string]: JSDocTag[]})

  const removeTrainlingSpaces = (text: string) => text.replace(/ +$/gm, '')

  for (const renderFunctionName of Object.keys(exampleTags)) {
    const hasCompleteExample = typeof examples[renderFunctionName]!.complete !== 'undefined'
    // eslint-disable-next-line no-await-in-loop
    const basicExample = await examples[renderFunctionName]!.basic()
    const tags = [
      {
        tagName: 'example',
        text: unstyled(`${hasCompleteExample ? 'Basic' : ''}\n${removeTrainlingSpaces(basicExample)}`),
      },
    ]

    if (hasCompleteExample) {
      // eslint-disable-next-line no-await-in-loop
      const completeExample = await examples[renderFunctionName]!.complete!()
      tags.push({
        tagName: 'example',
        text: unstyled(`Complete\n${removeTrainlingSpaces(completeExample)}`),
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
  // eslint-disable-next-line no-catch-all/no-catch-all
} catch (error) {
  process.exit(1)
}

process.exit(0)
