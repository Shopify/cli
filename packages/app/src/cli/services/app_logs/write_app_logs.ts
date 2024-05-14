// import {writeFile} from '@shopify/cli-kit/node/fs'
import {AppEventData} from './fetch_app_logs.js'
import fs from 'fs'
import {Writable} from 'stream'

export const writeAppLogsToFile = async ({
  appLog,
  writePath,
  stdout,
  label,
}: {
  appLog: AppEventData
  writePath: string
  stdout: Writable
  label: string
}) => {
  // console.log('writing log to file')
  // console.log('appLog', appLog)
  // console.log('writePath', writePath)

  // Perhaps use the event timestamp for the filename here, requires passng in more than payload
  // should be easy refactor
  const fileName = `app_logs_${label}.json`
  const toSaveData = {
    ...appLog,
  }

  try {
    const parsedPayload = JSON.parse(appLog.payload)
    // console.log('parsedPayload', parsedPayload)

    // Optionally manipulate the payload object here if needed
    // For example, you might want to add or modify some data:
    // parsedPayload.newField = "new value";

    // Replace the string payload with the parsed object
    toSaveData.payload = parsedPayload
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    stdout.write(`Error parsing payload: ${error}\n`)
  }

  const logData = JSON.stringify(toSaveData, null, 2)
  console.log('logData', logData)

  // console.log('fileName', fileName)
  // console.log('logData', logData)
  try {
    // eslint-disable-next-line node/prefer-promises/fs
    await fs.writeFile(`${writePath}/${fileName}`, logData, {}, () => {
      // Todo: Make this directlory if it doesn't exist
      // Maybe somewhere in the startup process
      // console.log('Wrote log to file')
      stdout.write(`Wrote log to ${writePath}/${fileName}\n`)
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // console.log('Error occurred while writing logs to file', error)
    stdout.write(`${error}\n`)
  }
}
