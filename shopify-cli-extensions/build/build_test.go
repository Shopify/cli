package build

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
)

var (
	config *core.Config
)

func init() {
	configFile, err := os.Open("testdata/shopifile.yml")
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
	runnerWasCalled := false
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		if script != "build" {
			t.Errorf("Expected script to be build, got %v", script)
		}

		runnerWasCalled = true
		return nil
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner), config.Extensions[0]}
	builder.Build(context.TODO(), func(result Result) {
		if !result.Success {
			t.Error("Expected Build operation to be successful")
		}

		if result.Error != nil {
			t.Errorf("Expected error to be nil, got %s", result.Error)
		}
	})

	if !runnerWasCalled {
		t.Error("Runner not invoked")
	}
}

func TestBuildErrors(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		return errors.New("Error")
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner), config.Extensions[0]}
	builder.Build(context.TODO(), func(result Result) {
		if result.Success {
			t.Error("Expected Build operation to fail with errors")
		}

		if result.Error == nil {
			t.Errorf("Expected error to not be nil")
		}
	})
}

func TestDevelop(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		if script != "develop" {
			t.Errorf("Expected script to be develop, got %v", script)
		}
		return nil
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner), config.Extensions[0]}

	builder.Develop(context.TODO(), func(result Result) {
		if !result.Success {
			t.Error("Expected Develop to be successful")
		}

		if result.Error != nil {
			t.Errorf("Unexpected error: %v", result.Error)
		}
	})
}

func TestWatch(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		return nil
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner), config.Extensions[0]}

	d := time.Now().Add(5 * time.Millisecond)
	ctx, cancel := context.WithDeadline(context.Background(), d)
	defer cancel()

	go builder.Watch(ctx, func(result Result) {
		if !result.Success {
			t.Error("Expected Watch to be successful")
		}
	})
}
