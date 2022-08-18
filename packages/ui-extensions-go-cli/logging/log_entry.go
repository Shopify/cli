package logging

import (
	"encoding/json"
	"log"
	"os"
)

type EntryType string

const (
	// Create flow
	Create_started   EntryType = "create.started"
	Create_info      EntryType = "create.progress"
	Create_completed EntryType = "create.completed"
	Create_error     EntryType = "create.error"
	// Build Flow
	Build_started   EntryType = "build.started"
	Build_info      EntryType = "build.progress"
	Build_completed EntryType = "build.completed"
	Build_error     EntryType = "build.error"
	// Serve flow
	Serve_started   EntryType = "serve.started"
	Serve_info      EntryType = "serve.progress"
	Serve_completed EntryType = "serve.completed"
	Serve_error     EntryType = "serve.error"
	//api
	Api_started   EntryType = "api.started"
	Api_error     EntryType = "api.error"
	Api_completed EntryType = "api.completed"
	// General
	General_error        EntryType = "general.error"
	General_info         EntryType = "general.progress"
	General_config_error EntryType = "general.config.error"
)

func (et EntryType) String() string {
	switch et {
	case Create_started:
		return "create.started"
	case Create_info:
		return "create.progress"
	case Create_completed:
		return "create.completed"
	case Create_error:
		return "create.error"
	case Build_started:
		return "build.started"
	case Build_info:
		return "build.progress"
	case Build_completed:
		return "build.completed"
	case Build_error:
		return "build.error"
	case Serve_started:
		return "serve.started"
	case Serve_info:
		return "serve.progress"
	case Serve_completed:
		return "serve.completed"
	case Serve_error:
		return "serve.error"
	case General_error:
		return "general.error"
	case General_info:
		return "general.progress"
	default:
		panic("")
	}
}

type LogEntry struct {
	Type        EntryType
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
func (l LogEntry) WriteLog() {
	log.SetOutput(os.Stdout)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.to_json())
	log.Println("#END_LOG_ENTRY#")
}

func (l LogEntry) WriteErrorLog() {
	log.SetOutput(os.Stderr)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.to_json())
	log.Println("#END_LOG_ENTRY#")
}

func (t EntryType) CreateLogEntry(extensionId string, message string) LogEntry {
	entry := LogEntry{Type: t, ExtensionId: extensionId}
	entry.Payload = t.CreatePayload(message)
	return entry
}
