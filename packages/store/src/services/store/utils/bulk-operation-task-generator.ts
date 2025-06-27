import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Task} from '@shopify/cli-kit/node/ui'

export interface BulkOperationConfig {
  operationName: string
  pollingTaskCount?: number
  pollingInterval?: number
  emojis?: string[]
}

export interface BulkOperationContext {
  operation: BulkDataOperationByIdResponse
  organizationId: string
  bpSession: string
  isComplete: boolean
}

export interface BulkOperationCallbacks<TContext extends BulkOperationContext> {
  startOperation: (ctx: TContext) => Promise<BulkDataOperationByIdResponse>
  pollOperation: (ctx: TContext) => Promise<BulkDataOperationByIdResponse>
  onComplete?: (ctx: TContext) => Promise<void>
}

export class BulkOperationTaskGenerator {
  private readonly config: Required<BulkOperationConfig>

  constructor(config: BulkOperationConfig) {
    this.config = {
      operationName: config.operationName,
      pollingTaskCount: config.pollingTaskCount ?? 1800,
      pollingInterval: config.pollingInterval ?? 3000,
      emojis: config.emojis ?? ['🚀', '✨', '🔥', '💫', '🌟'],
    }
  }

  generateTasks<TContext extends BulkOperationContext>(callbacks: BulkOperationCallbacks<TContext>): Task<TContext>[] {
    return [this.createStartTask(callbacks), ...this.createPollingTasks(callbacks), this.createFinalizingTask()]
  }

  private createStartTask<TContext extends BulkOperationContext>(
    callbacks: BulkOperationCallbacks<TContext>,
  ): Task<TContext> {
    return {
      title: `Starting ${this.config.operationName} operation`,
      task: async (ctx: TContext) => {
        // eslint-disable-next-line require-atomic-updates
        ctx.operation = await callbacks.startOperation(ctx)
        const status = ctx.operation.organization.bulkData.operation.status
        if (status === 'COMPLETED' || status === 'FAILED') {
          ctx.isComplete = true
          if (callbacks.onComplete) {
            await callbacks.onComplete(ctx)
          }
        }
        await new Promise((resolve) => setTimeout(resolve, this.config.pollingInterval))
      },
    }
  }

  private createPollingTasks<TContext extends BulkOperationContext>(
    callbacks: BulkOperationCallbacks<TContext>,
  ): Task<TContext>[] {
    const pollingTasks: Task<TContext>[] = []

    for (let i = 0; i < this.config.pollingTaskCount; i++) {
      const emoji = this.config.emojis[Math.floor(Math.random() * this.config.emojis.length)]

      pollingTasks.push({
        title: `${this.capitalize(this.config.operationName)} data ${emoji}`,
        skip: (ctx: TContext) => ctx.isComplete,
        task: async (ctx: TContext) => {
          // eslint-disable-next-line require-atomic-updates
          ctx.operation = await callbacks.pollOperation(ctx)
          const status = ctx.operation.organization.bulkData.operation.status

          if (status === 'COMPLETED' || status === 'FAILED') {
            ctx.isComplete = true
            if (callbacks.onComplete) {
              await callbacks.onComplete(ctx)
            }
          }

          return [
            {
              title: `${this.capitalize(this.config.operationName)} data ${emoji}`,
              task: async () => {
                await new Promise((resolve) => setTimeout(resolve, this.config.pollingInterval))
              },
            },
          ]
        },
      })
    }

    return pollingTasks
  }

  private createFinalizingTask<TContext extends BulkOperationContext>(): Task<TContext> {
    return {
      title: 'Finalizing operation',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      },
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
