package build

import (
	"fmt"

	"github.com/Shopify/shopify-cli-extensions/core"
)

type Result struct {
	Success   bool
	Message   string
	Extension core.Extension
}

func (r Result) String() string {
	if r.Success {
		return fmt.Sprintf("Successfully built Extension %s", r.Extension)
	} else {
		return fmt.Sprintf("Failed to build Extension %s\n%s", r.Extension, r.Message)
	}
}
