import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import {createRequire} from 'module'
import {unstyled, shouldDisplayColors} from '../../../../public/node/output.js'

const require = createRequire(import.meta.url)
const gitDiff = require('git-diff')

export interface GitDiffProps {
  baselineContent: string
  updatedContent: string
}

/**
 * `FilePath` displays a path to a file.
 */
const GitDiff: FunctionComponent<GitDiffProps> = ({baselineContent, updatedContent}): JSX.Element => {
  const rawDiffContents = gitDiff(
    baselineContent,
    updatedContent,
    {
      color: shouldDisplayColors(),
      // Show minimal context to accommodate small terminals.
      flags: "--unified=1 --inter-hunk-context=1",
    },
  )
  if (!rawDiffContents) {
    return <Text>No changes.</Text>
  }
  const diffContents = rawDiffContents.split('\n').map((line: string, index: number) => {
    if (line === '\\ No newline at end of file') {
      return line
    } else if (unstyled(line).match(/^@@/)) {
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
