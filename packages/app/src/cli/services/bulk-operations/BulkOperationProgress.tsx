import {
  GetBulkOperationById,
  GetBulkOperationByIdQuery,
} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Text, Box, useApp} from '@shopify/cli-kit/node/ink'
import React, {useState, useEffect} from 'react'

type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']> & {
  status: string
  objectCount: unknown
}

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED']
const POLL_INTERVAL_SECONDS = 5
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface BulkOperationProgressProps {
  id: string
  adminSession: AdminSession
  onComplete: (operation: BulkOperation | null) => void
}

export function BulkOperationProgress({id, adminSession, onComplete}: BulkOperationProgressProps) {
  const {exit} = useApp()
  const [operation, setOperation] = useState<BulkOperation | null>(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (isDone) return

    const spinnerInterval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)

    return () => clearInterval(spinnerInterval)
  }, [isDone])

  useEffect(() => {
    let mounted = true

    const poll = async () => {
      const response = await adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
        query: GetBulkOperationById,
        session: adminSession,
        variables: {id},
        version: '2026-01',
      })

      if (!mounted) return

      if (!response.bulkOperation) {
        onComplete(null)
        setIsDone(true)
        exit()
        return
      }

      const op = response.bulkOperation as BulkOperation
      setOperation(op)

      if ('status' in op && TERMINAL_STATUSES.includes(op.status)) {
        onComplete(op)
        setIsDone(true)
        exit()
        return
      }

      setTimeout(() => {
        poll().catch(() => {})
      }, POLL_INTERVAL_SECONDS * 1000)
    }

    poll().catch(() => {})

    return () => {
      mounted = false
    }
  }, [id, adminSession, onComplete])

  if (isDone) {
    return null
  }

  const spinner = SPINNER_FRAMES[spinnerFrame] ?? '⠋'

  const renderOperationDetails = (operation: BulkOperation) => {
    switch (operation.status) {
      case 'RUNNING':
        return <>
            <Text>{spinner} Bulk operation in progress...</Text>
            <Text> • Objects: {String(operation.objectCount)}</Text>
          </>
      case 'CREATED':
        return <Text>{spinner} Starting...</Text>
      case 'COMPLETED':
        const url = operation.url ?? ''
        const shortUrl = url.length > 50 ? `${url.slice(0, 15)}[...]${url.slice(-15)}` : url

        return <>
          <Text>Bulk operation succeeded.</Text>
          <Text> • Objects: {String(operation.objectCount)}</Text>
          <Text> • Download results: {shortUrl}</Text>
        </>
      case 'FAILED':
        return <>
          <Text>Bulk operation failed.</Text>
          <Text> • Objects: {String(operation.objectCount)}</Text>
          <Text> • Error code: {operation.errorCode}</Text>
        </>
      case 'CANCELING':
        return <Text>Bulk operation canceling...</Text>
      case 'CANCELED':
        return <Text>Bulk operation canceled.</Text>
      case 'EXPIRED':
        return <Text>Bulk operation expired.</Text>
    }
  }

  return (
    <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
      {operation ? renderOperationDetails(operation) : <Text>Bulk operation loading...</Text>}
    </Box>
  )
}
