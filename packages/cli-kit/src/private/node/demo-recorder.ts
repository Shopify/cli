import {isTruthy} from './context/utilities.js'

interface Event {
  type: string
  properties: any
}

class DemoRecorder {
  recorded: any[]
  sleepStart: number

  constructor() {
    this.recorded = []
    this.sleepStart = Date.now()
  }

  addEvent({type, properties}: Event) {
    if (type === 'taskbar' || type.endsWith('Prompt')) {
      this.resetSleep()
    } else {
      this.addSleep()
    }
    this.recorded.push({type, properties: JSON.parse(JSON.stringify(properties))})
    this.sleepStart = Date.now()
  }

  recordedEventsJson() {
    return JSON.stringify({steps: this.recorded}, null, 2)
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
  }) {
    let last = this.recorded[this.recorded.length - 1]
    if (last?.type !== 'concurrent') {
      this.addEvent({type: 'concurrent', properties: {processes: []}})
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
    processes[index].steps.push({duration: 1, endMessage: output})
  }
}

class NoopDemoRecorder {
  addEvent(_event: Event) {}

  recordedEventsJson() {
    return JSON.stringify({steps: []}, null, 2)
  }

  resetSleep() {}

  addOrUpdateConcurrentOutput(_data: {prefix: string; index: number; output: string}) {}
}

let _instance: {
  addEvent: (event: Event) => void
  recordedEventsJson: () => string
  resetSleep: () => void
  addOrUpdateConcurrentOutput: ({prefix, index, output}: {
    prefix: string
    index: number
    output: string
  }) => void
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
    console.log(_instance.recordedEventsJson())
  }
}

export function addOrUpdateConcurrentOutput(data: {prefix: string; index: number; output: string}) {
  ensureInstance()
  _instance.addOrUpdateConcurrentOutput(data)
}

function isRecording() {
  return isTruthy(process.env.RECORD_DEMO)
}
