import Command from '@shopify/cli-kit/node/base-command'
import {Notifications, getLocalNotifications, stringifyFilters} from '@shopify/cli-kit/node/notifications-system'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export default class List extends Command {
  static description = 'List current notifications configured for the CLI.'
  static hidden = true

  async run(): Promise<void> {
    const notifications: Notifications = await getLocalNotifications()

    const rows = notifications.notifications.map((notification) => {
      return {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        filters: stringifyFilters(notification),
      }
    })

    renderTable({
      rows,
      columns: {
        type: {
          header: 'Type',
          color: 'dim',
        },
        title: {
          header: 'Title',
          color: 'dim',
        },
        message: {
          header: 'Message',
          color: 'dim',
        },
        filters: {
          header: 'Filters',
          color: 'dim',
        },
      },
    })
    outputInfo('\n')
  }
}
