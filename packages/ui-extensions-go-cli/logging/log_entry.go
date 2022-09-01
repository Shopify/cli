package logging

import (
	"encoding/json"
	"log"
	"os"
	"strings"
)

type LogEntry struct {
	WorkflowStep  string      `json:"workflowStep,omitempty"`
	Status        LogStatus   `json:"status,omitempty"`
	Level         LogLevel    `json:"level,omitempty"`
	ExtensionID   string      `json:"extensionId,omitempty"`
	ExtensionName string      `json:"extensionName,omitempty"`
	Payload       interface{} `json:"payload,omitempty"`
}

type LogEntryBuilder struct {
	WorkflowStep  string
	Status        LogStatus
	ExtensionID   string
	ExtensionName string
}

func Builder() LogEntryBuilder {
	return LogEntryBuilder{WorkflowStep: ""}
}

func (l *LogEntry) WriteLog(outputStream *os.File) {
	l.Level = Info
	log.SetOutput(outputStream)
	log.Print(l.toJson() + "###LOG_END###")
}

func (l *LogEntry) WriteErrorLog(outputStream *os.File) {
	l.Level = Error
	log.SetOutput(outputStream)
	log.Print(l.toJson() + "###LOG_END###")
}

func (b *LogEntryBuilder) Build(message string) *LogEntry {
	return &LogEntry{WorkflowStep: b.WorkflowStep, Status: b.Status, ExtensionName: b.ExtensionName, ExtensionID: b.ExtensionID, Payload: b.Status.CreatePayload(message)}
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

func (b *LogEntryBuilder) SetExtensionName(name string) {
	b.ExtensionName = name
}

func (b *LogEntryBuilder) SetExtensionId(id string) {
	b.ExtensionID = id
}
