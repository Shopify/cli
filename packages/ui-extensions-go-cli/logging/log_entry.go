package logging

import (
	"encoding/json"
	"log"
	"os"
)

type LogType string
const (
  Serve LogType = "serve"
  Api LogType = "api"
  Server LogType = "server"
  Build LogType = "build"
  Watch LogType = "watch"
  WatchLocalization LogType = "watchLocalization"
  Create LogType = "create"
  Config LogType = "config"
  Validate LogType = "validate"
)

type LogStatus string
const (
  Started LogStatus ="start"
  Progress LogStatus = "progress"
  Failed LogStatus = "fail"
  Completed LogStatus ="complete"
)

type LogLevel string
const (
  Info LogLevel = "info"
  Error LogLevel ="error"
)

type LogEntry struct {
	Context     string
  Status   LogStatus
  Level       LogLevel
	ExtensionId string
	Payload     interface{}
}

func (l LogEntry) to_json() string {
	json_log, err := json.Marshal(l)
	if err != nil {
		panic(err)
	}
	return string(json_log)
}
func (l LogEntry) WriteLog(outputStream *os.File) {
  l.Level = Info
	log.SetOutput(outputStream)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.to_json())
	log.Println("#END_LOG_ENTRY#")
}

func (l LogEntry) WriteErrorLog(outputStream *os.File) {
  l.Level = Error
	log.SetOutput(outputStream)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.to_json())
	log.Println("#END_LOG_ENTRY#")
}


type LogEntryBuilder struct {
  Context string
}

func NewLogEntryBuilder() LogEntryBuilder {
  return LogEntryBuilder{Context:""}
}

func (b LogEntryBuilder)AddContext(context LogType) LogEntryBuilder {
  if b.Context!="" {
    return LogEntryBuilder{Context: b.Context + "." + string(context)}
  }
  return LogEntryBuilder{Context: string(context)}
}

func (b LogEntryBuilder)Build(status LogStatus, extensionId string, message string) LogEntry {
  return LogEntry{Context:b.Context, Status: status, ExtensionId: extensionId, Payload: status.CreatePayload(message)}
}
