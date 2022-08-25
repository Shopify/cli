package logging

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
	switch t {
	case Failure:
		return ErrorPayload{Message: message}
	default:
		return InfoPayload{Message: message}
	}
}
