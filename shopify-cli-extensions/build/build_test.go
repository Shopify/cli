package build

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestBuild(t *testing.T) {
	runnerWasCalled := false
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		runnerWasCalled = true
		return nil
	}
	builder := Builder{ScriptRunnerFunc(fakeRunner)}
	err := builder.Build(context.TODO())

	if err != nil {
		t.Errorf("Expected error to be nil, got %s", err)
	}

	if !runnerWasCalled {
		t.Error("Runner not invoked")
	}
}

func TestBuildErrors(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		return errors.New("Error")
	}
	builder := Builder{ScriptRunnerFunc(fakeRunner)}
	err := builder.Build(context.TODO())

	if err == nil {
		t.Errorf("Unexpected error %v", err)
	}
}

func TestDevelop(t *testing.T) {
	fakeRunner := func(ctx context.Context, script string, args ...string) error {
		return nil
	}
	builder := Builder{ScriptRunnerFunc(fakeRunner)}

	d := time.Now().Add(1 * time.Millisecond)
	ctx, cancel := context.WithDeadline(context.Background(), d)
	defer cancel()

	err := builder.Develop(ctx, "testdata", func(result Result) {})

	if err != nil {
		t.Errorf("Unexpected error %v", err)
	}
}
