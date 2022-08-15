package build

import (
	"testing"
)

func TestVerifyAssets(t *testing.T) {
	extension := config.Extensions[0]

	if len(extension.Development.Entries) != 1 {
		t.Fatal("expected the extension to have one entry")
	}

	err := verifyAssets(extension)
	if err != nil {
		t.Error(err)
	}

	extension.Development.Entries["missing"] = "src/missing.ts"
	err = verifyAssets(extension)
	if err == nil {
		t.Error("Expected missing asset to be reported")
	}
}
