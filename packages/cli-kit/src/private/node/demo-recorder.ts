import {isTruthy} from './context/utilities.js'
import {ConcurrentOutputProps} from './ui/components/ConcurrentOutput.js'

interface Event {
  type: string
  properties: any
  // Only used within this recorder for tracking concurrency timeline
  concurrencyStart?: number
}

interface ConcurrencyStep {
  timestamp: number
  endMessage: string
}

class DemoRecorder {
  recorded: any[]
  sleepStart: number
  command: string

  constructor() {
    this.recorded = []
    this.sleepStart = Date.now()
    this.command = ['shopify', ...process.argv.slice(2)].join(' ')
  }

  addEvent({type, properties}: Event) {
    if (type === 'taskbar') {
      this.resetSleep()
    } else {
      this.addSleep()
    }
    this.recorded.push({type, properties: JSON.parse(JSON.stringify(properties))})
    this.sleepStart = Date.now()
  }

  recordedEventsJson() {
    return JSON.stringify({
      command: this.command,
      steps: this.withFormattedConcurrent(this.recorded),
    }, null, 2)
  }

  addSleep() {
    const duration = (Date.now() - this.sleepStart) / 1000
    this.sleepStart = Date.now()
    if (duration > 0.1) {
      this.recorded.push({type: 'sleep', properties: {duration}})
    }
  }

  resetSleep() {
    this.sleepStart = Date.now()
  }

  addOrUpdateConcurrentOutput({prefix, index, output}: {
    prefix: string
    index: number
    output: string
  }, {footer}: {footer: ConcurrentOutputProps['footer']}) {
    let last = this.recorded[this.recorded.length - 1]
    if (last?.type !== 'concurrent') {
      const eventProperties: Event = {
        type: 'concurrent', properties: {processes: [], concurrencyStart: Date.now()}
      }
      if (footer) eventProperties.properties.footer = footer
      this.addEvent(eventProperties)
      last = this.recorded[this.recorded.length - 1]
    } else {
      // Don't sleep between concurrent lines
      this.resetSleep()
    }
    const {processes} = last.properties
    while (processes.length <= index) {
      processes.push({prefix: '', steps: []})
    }
    processes[index].prefix = prefix
    processes[index].steps.push({timestamp: Date.now(), endMessage: output})
  }

  withFormattedConcurrent(recorded: Event[]) {
    return recorded.map(event => {
      if (event.type === 'concurrent') {
        const {processes, footer, concurrencyStart} = event.properties
        const formatted = processes.map(({prefix, steps}: {prefix: string, steps: ConcurrencyStep[]}) => {
          let mostRecentTimestamp = concurrencyStart
          const formattedSteps = steps.map(({timestamp, endMessage}) => {
            const duration = (timestamp - mostRecentTimestamp) / 1000
            mostRecentTimestamp = timestamp
            return {duration, endMessage}
          })
          return {prefix, steps: formattedSteps}
        })
        return {type: 'concurrent', properties: {footer, processes: formatted}}
      }
      return event
    })
  }
}

class NoopDemoRecorder {
  addEvent(_event: Event) {}

  recordedEventsJson() {
    return JSON.stringify({steps: []}, null, 2)
  }

  addSleep() {}
  resetSleep() {}

  addOrUpdateConcurrentOutput(..._args: any) {}
}

let _instance: {
  addEvent: (event: Event) => void
  recordedEventsJson: () => string
  resetSleep: () => void
  addSleep: () => void
  addOrUpdateConcurrentOutput: ({prefix, index, output}: {
    prefix: string
    index: number
    output: string
  }, {footer}: {footer: ConcurrentOutputProps['footer']}) => void
}

function ensureInstance() {
  if (!_instance) {
    if (isRecording()) {
      _instance = new DemoRecorder()
    } else {
      _instance = new NoopDemoRecorder()
    }
  }
}

export function initDemoRecorder() {
  ensureInstance()
}

export function addEvent(event: Event) {
  ensureInstance()
  _instance.addEvent(event)
}

export function resetSleep() {
  ensureInstance()
  _instance.resetSleep()
}

export function printEventsJson(): void {
  if (isRecording()) {
    ensureInstance()
    _instance.addSleep()
    console.log(_instance.recordedEventsJson())
  }
}

export function addOrUpdateConcurrentOutput(data: {
    prefix: string
    index: number
    output: string
  }, componentData: {footer: ConcurrentOutputProps['footer']}) {
  ensureInstance()
  _instance.addOrUpdateConcurrentOutput(data, componentData)
}

function isRecording() {
  return isTruthy(process.env.RECORD_DEMO)
}
