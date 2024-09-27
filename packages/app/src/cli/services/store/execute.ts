import {AdminSession, ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputContent, outputInfo, outputSuccess, outputToken} from '@shopify/cli-kit/node/output'

export interface ExecuteOptions {
  scriptFile: string
  shop: string
}

export async function executeStoreScript(options: ExecuteOptions): Promise<void> {
  const adminSession: AdminSession = await ensureAuthenticatedAdmin(options.shop)

  outputInfo(
    outputContent`Running script ${outputToken.path(options.scriptFile)} on store ${outputToken.raw(options.shop)}`,
  )

  const startOfExecution = new Date()

  const env = {
    ...process.env,
    STORE_FQDN: await normalizeStoreFqdn(adminSession.storeFqdn),
    ACCESS_TOKEN: adminSession.token,
    API_VERSION: '2024-07',
  }

  try {
    await exec(process.execPath, [options.scriptFile], {
      env,
      stdio: 'inherit',
    })

    const endOfExecution = new Date()
    const executionTime = endOfExecution.getTime() - startOfExecution.getTime()

    outputSuccess(`Script ran in ${executionTime}ms`)
  } catch (error) {
    let errorMessage = 'An error occurred while executing the script.'
    let errorDetails = ''

    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack ?? ''
    }

    throw new AbortError(
      `Script execution failed: ${errorMessage}`,
      'There was an issue running your script. Please check the error details and your script for any issues.',
      [
        'Review your script for any syntax errors or logical issues.',
        'Ensure all required dependencies are installed.',
        'Check if the script has the necessary permissions to execute.',
      ],
      [
        {
          title: 'Error Details',
          body: errorDetails,
        },
      ],
    )
  }
}
