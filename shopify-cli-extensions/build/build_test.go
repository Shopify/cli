package build

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
)

var config *core.Config

func init() {
	configFile, err := os.Open("testdata/extension.config.yml")
	if err != nil {
		panic(fmt.Errorf("unable to open file: %w", err))
	}
	defer configFile.Close()

	config, err = core.LoadConfig(configFile)
	if err != nil {
		panic(fmt.Errorf("unable to load config: %w", err))
	}

	if len(config.Extensions) < 1 {
		panic("tests won't run without extensions")
	}
}

func TestBuild(t *testing.T) {
	extension := config.Extensions[0]

	err := os.RemoveAll(extension.BuildDir())
	if err != nil {
		t.Fatal(err)
	}

	Build(extension, func(result Result) {
		if !result.Success {
			t.Error("expected extension to build successfully")
			t.Error(result.Message)
		}
	})

	if _, err = os.Stat(filepath.Join(extension.BuildDir(), "main.js")); err != nil {
		t.Error("expected main.js to exist")
	}

	if _, err = os.Stat(filepath.Join(extension.BuildDir(), "main.js.LEGAL.txt")); err != nil {
		t.Error("expected main.js.LEGAL.txt to exist")
	}
}

func TestWatch(t *testing.T) {
	extension := config.Extensions[0]

	err := os.Remove(filepath.Join(extension.BuildDir(), "main.js"))
	if err != nil {
		t.Fatal(err)
	}

	results := []Result{}
	Watch(extension, func(result Result) {
		results = append(results, result)
	})

	if len(results) != 2 {
		t.Fatal("expected 2 results")
	}

	if results[0].Success {
		t.Error("expected first build to fail")
	}

	if !results[1].Success {
		t.Error("expected second build to succeed")
	}

	if _, err = os.Stat(filepath.Join(extension.BuildDir(), "main.js")); err != nil {
		t.Error("expected main.js to exist")
	}
}
