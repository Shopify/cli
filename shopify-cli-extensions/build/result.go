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
	return fmt.Sprintf("%s\n%s", r.Extension, r.Message)
}
