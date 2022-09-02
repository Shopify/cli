package build

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/logging"
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

	if results[0].Extension.Assets["main"].LastUpdated != 0 {
		t.Errorf("expected first build to not update the last updated timestamp but got %d", results[0].Extension.Assets["main"].LastUpdated)
	}

	if !results[1].Success {
		t.Error("expected second build to succeed")
	}

	if results[1].Extension.Assets["main"].LastUpdated == 0 {
		t.Errorf("expected second build to update the last updated timestamp but got %d", results[1].Extension.Assets["main"].LastUpdated)
	}

	if _, err = os.Stat(filepath.Join(extension.BuildDir(), "main.js")); err != nil {
		t.Error("expected main.js to exist")
	}
}

func TestWatchLocalization(t *testing.T) {
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(context.Background())

	extension := config.Extensions[0]
	locales_filepath := filepath.Join(".", extension.Development.RootDir, "locales")

	os.RemoveAll(locales_filepath)
	err := os.Mkdir(locales_filepath, 0775)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		os.RemoveAll(locales_filepath)
	})
	en_content := []byte("{\"key\":\"value\"}")
	err = os.WriteFile(filepath.Join(locales_filepath, "en.default.json"), en_content, 0775)
	if err != nil {
		t.Fatal(err)
	}

	results := []Result{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		WatchLocalization(ctx, extension, func(result Result) {
			results = append(results, result)
		}, logging.Builder().AddWorkflowSteps("test"))
	}()

	// done
	cancel()
	// wait while all goroutines will end their job
	wg.Wait()

	if len(results) != 1 {
		t.Errorf("expected 1 result but got %d\n", len(results))
	}

	if !results[0].Success {
		t.Error("expected first build to succeed")
	}

	value, err := json.Marshal(results[0].Extension.Localization.Translations["en"])
	if string(value) != "{\"key\":\"value\"}" {
		t.Errorf("expected correct translation for 'en' but received %s\n", string(value))
	}
}
