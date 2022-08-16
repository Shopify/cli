package build

import (
	"fmt"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
)

type Result struct {
	Success   bool
	Message   string
	Extension core.Extension
}

func (r Result) String() string {
	return fmt.Sprintf("%s (%s)", r.Extension, strings.TrimSpace(r.Message))
}
