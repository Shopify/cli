package logging

import (
  "regexp"
)
type ErrorPayload struct {
  Message string
  StackTrace string
  RecoveryStep string
}

type InfoPayload struct {
  Message string
}
var errorPayload = regexp.MustCompile(`\.error$`)
func (t EntryType)CreatePayload(message string) interface{} {
  switch  {
  case errorPayload.MatchString(t.String()):
    return ErrorPayload{Message: message}

  default:
    return InfoPayload{Message: message}
  }
}
