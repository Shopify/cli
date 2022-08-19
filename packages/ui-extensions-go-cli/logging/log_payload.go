package logging

type ErrorPayload struct {
	Message      string
	StackTrace   string
	RecoveryStep string
}

type FilePayload struct {
	Message  string
	FilePath string
}
type CompletedPayload struct {
	Message   string
	Success   bool
	Timestamp int64
}
type StartedPayload struct {
	Message   string
	Timestamp int64
}

type InfoPayload struct {
	Message string
}

func (t LogStatus) CreatePayload(message string) interface{} {
	// TODO is the payload status specific?
  switch t {
	case Failed:
		return FilePayload{Message: message}
	default:
		return InfoPayload{Message: message}
	}
}
