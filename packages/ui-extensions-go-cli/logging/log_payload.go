package logging

import (
	"encoding/json"
)

type ErrorPayload struct {
	Message      string `json:"message,omitempty"`
	StackTrace   string `json:"stackTrace,omitempty"`
	RecoveryStep string `json:"recoveryStep,omitempty"`
}

type InfoPayload struct {
	Message string `json:"message,omitempty"`
}

func (t LogStatus) CreatePayload(message string) interface{} {
	// TODO is the payload status specific?

  encodedMessage, _ := json.Marshal(message)
	switch t {
	case Failure:
		return ErrorPayload{Message: string(encodedMessage[1:len(encodedMessage)-1])}
	default:
		return InfoPayload{Message: string(encodedMessage[1:len(encodedMessage)-1])}
	}
}
