package build

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os/exec"

	"github.com/fsnotify/fsnotify"
)

func NewBuilder(workingDir string) *Builder {
	pm := FindPackageManager(exec.LookPath, workingDir)
	return &Builder{pm}
}

type Builder struct {
	ScriptRunner
}

type Result struct {
	Success bool
}

// production build
func (b *Builder) Build(ctx context.Context) error {
	if err := b.RunScript(ctx, "build"); err != nil {
		return fmt.Errorf("Build process failed: %v", err)
	}

	return nil
}

// development build
func (b *Builder) Develop(ctx context.Context, dir string, yield func(result Result)) error {
	if err := b.RunScript(ctx, "develop"); err != nil {
		return errors.New(fmt.Sprintf("Error running Develop script: %s", err))
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		panic(err)
	}
	defer watcher.Close()

	if err = watcher.Add(dir); err != nil {
		panic(err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("Terminating watcher")
			return nil
		case event := <-watcher.Events:
			if event.Op&fsnotify.Write == fsnotify.Write {
				log.Printf("file system event: %v\n", event)
				yield(Result{true})
			}
		case err = <-watcher.Errors:
			log.Printf("file system error: %v\n", err)
			yield(Result{false})
		}
	}
}

type ScriptRunner interface {
	RunScript(ctx context.Context, script string, args ...string) error
}

type ScriptRunnerFunc func(ctx context.Context, script string, args ...string) error

func (f ScriptRunnerFunc) RunScript(ctx context.Context, script string, args ...string) error {
	if err := f(ctx, script, args...); err != nil {
		return err
	}
	return nil
}
