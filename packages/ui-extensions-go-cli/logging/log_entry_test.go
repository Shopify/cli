package logging

import (
	"testing"
)

func TestParseToJson(t *testing.T) {

	Init()

	log_entry :=LogEntry{
    Type: General_info,
    ExtensionId: "ext-id",
    Payload: InfoPayload{ Message:"test Log info"},
  }
  log_entry.to_json()

}
