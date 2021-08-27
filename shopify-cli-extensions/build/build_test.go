package build

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestBuild(t *testing.T) {
	runnerWasCalled := false
	fakeRunner := func(ctx context.Context, script string, args ...string) (string, error) {
		if script != "build" {
			t.Errorf("Expected script to be build, got %v", script)
		}

		runnerWasCalled = true
		return "", nil
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner)}
	result := builder.Build(context.TODO())

	if !result.Success {
		t.Error("Expected Build operation to be successful")
	}

	if result.Error != nil {
		t.Errorf("Expected error to be nil, got %s", result.Error)
	}

	if !runnerWasCalled {
		t.Error("Runner not invoked")
	}
}

func TestBuildErrors(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) (string, error) {
		return "", errors.New("Error")
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner)}
	result := builder.Build(context.TODO())

	if result.Success {
		t.Error("Expected Build operation to fail with errors")
	}

	if result.Error == nil {
		t.Errorf("Expected error to not be nil")
	}
}

func TestDevelop(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) (string, error) {
		if script != "develop" {
			t.Errorf("Expected script to be develop, got %v", script)
		}
		return "", nil
	}

	builder := Builder{ScriptRunnerFunc(fakeRunner)}

	d := time.Now().Add(1 * time.Millisecond)
	ctx, cancel := context.WithDeadline(context.Background(), d)
	defer cancel()

	result := builder.Develop(ctx, "testdata", func(result Result) {})

	if !result.Success {
		t.Error("Expected Develop to be successful")
	}

	if result.Error != nil {
		t.Errorf("Unexpected error %v", result.Error)
	}
}
