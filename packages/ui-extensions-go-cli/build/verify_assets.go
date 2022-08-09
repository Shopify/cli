package build

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Shopify/shopify-cli-extensions/core"
)

func verifyAssets(ext core.Extension) error {
	totalAssets := len(ext.Development.Entries)
	missingAssets := 0

	for name := range ext.Development.Entries {
		filename := fmt.Sprintf("%s.js", name)
		path := filepath.Join(ext.BuildDir(), filename)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			missingAssets += 1
		}
	}

	if missingAssets > 0 {
		return fmt.Errorf("missing %d assets of %d", missingAssets, totalAssets)
	}

	return nil
}
