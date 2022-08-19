package logging

import (
	"testing"
)

func TestParseToJson(t *testing.T) {

	Init()

  logBuilder := NewLogEntryBuilder()
  LogBuilderBase := logBuilder.AddContext("Base")
  logBuilderBaseExtendend := LogBuilderBase.AddContext("Extended")
  log_entry := logBuilderBaseExtendend.Build(Started,"ext_id", "test_message")

  log_entry.to_json()

}
