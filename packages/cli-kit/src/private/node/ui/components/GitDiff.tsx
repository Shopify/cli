import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import {createRequire} from 'module'
import {shouldDisplayColors} from '../../../../public/node/output.js'

const require = createRequire(import.meta.url)
const gitDiff = require('git-diff')

interface DiffProps {
  baselineContent: string
  updatedContent: string
}

/**
 * `FilePath` displays a path to a file.
 */
const GitDiff: FunctionComponent<DiffProps> = ({baselineContent, updatedContent}): JSX.Element => {
  const diffContents = gitDiff(
      baselineContent,
      updatedContent,
      {
        color: shouldDisplayColors(),
        flags: "--unified=1 --inter-hunk-context=1",
      },
    ).split('\n').map((line: string, index: number) => {
      if (line.match(/^[^+\-]*@/)) {
        return index === 0 ? line : line.replace('@@', '\n@@')
      } else {
        return line.replace(/([+\- ])/, (match) => {
          return `${match} `
        })
      }
    }).join('\n').trim()
  return <Text>{diffContents}</Text>
}

export {GitDiff}
