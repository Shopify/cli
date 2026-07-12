import {renderMarkdown} from '../markdown.js'
import {useComplete} from '../../ui.js'
import React, {useEffect, useState} from 'react'

import {Text} from 'ink'

interface MarkdownStreamProps<T> {
  task: (updateContent: (content: string) => void) => Promise<T>
  onComplete?: (result: T) => void
}

/**
 * Renders Markdown as ANSI-styled text, re-rendering it each time the task calls
 * `updateContent`. Unlike `SingleTask`, the final content stays on screen once the task
 * completes — it's the result the user asked for, not a transient status.
 */
const MarkdownStream = <T,>({task, onComplete}: MarkdownStreamProps<T>) => {
  const [content, setContent] = useState('')
  const [taskResult, setTaskResult] = useState<{error?: Error} | null>(null)
  const complete = useComplete()

  useEffect(() => {
    task(setContent)
      .then((result) => {
        onComplete?.(result)
        setTaskResult({})
      })
      .catch((error) => {
        setTaskResult({error})
      })
  }, [task, onComplete])

  useEffect(() => {
    if (taskResult !== null) {
      complete(taskResult.error)
    }
  }, [taskResult, complete])

  return <Text>{renderMarkdown(content)}</Text>
}

export {MarkdownStream}
