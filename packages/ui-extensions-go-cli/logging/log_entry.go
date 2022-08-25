package logging

import (
	"encoding/json"
	"log"
	"os"
	"strings"
)

type LogEntry struct {
	WorkflowStep string      `json:"workflowStep,omitempty"`
	Status       LogStatus   `json:"status,omitempty"`
	Level        LogLevel    `json:"level,omitempty"`
	ExtensionID  string      `json:"extensionId,omitempty"`
	Payload      interface{} `json:"payload,omitempty"`
}

type LogEntryBuilder struct {
	WorkflowStep string
	Status       LogStatus
}

func Builder() LogEntryBuilder {
	return LogEntryBuilder{WorkflowStep: ""}
}

func (l *LogEntry) WriteLog(outputStream *os.File) {
	l.Level = Info
	log.SetOutput(outputStream)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.toJson())
	log.Println("#END_LOG_ENTRY#")
}

func (l *LogEntry) WriteErrorLog(outputStream *os.File) {
	l.Level = Error
	log.SetOutput(outputStream)
	log.Println("#START_LOG_ENTRY#")
	log.Println(l.toJson())
	log.Println("#END_LOG_ENTRY#")
}

func (b *LogEntryBuilder) Build(extensionId string, message string) *LogEntry {
	return &LogEntry{WorkflowStep: b.WorkflowStep, Status: b.Status, ExtensionID: extensionId, Payload: b.Status.CreatePayload(message)}
}

func (l *LogEntry) toJson() string {
	json_log, err := json.Marshal(l)
	if err != nil {
		panic(err)
	}
	return string(json_log)
}

// LogEntryBuilder public methods
func (b LogEntryBuilder) AddWorkflowSteps(steps ...WorkflowStep) LogEntryBuilder {
	for _, step := range steps {
		if b.WorkflowStep != "" {
			b.WorkflowStep = strings.Join([]string{b.WorkflowStep, string(step)}, ".")
		} else {
			b.WorkflowStep = string(step)
		}
	}
	return b
}

func (b *LogEntryBuilder) SetStatus(status LogStatus) {
	b.Status = status
}
