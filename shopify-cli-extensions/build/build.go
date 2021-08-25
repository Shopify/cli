package build

import (
	"context"
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
	_, err := b.RunScript(ctx, "build")

	if err != nil {
		return fmt.Errorf("Build process failed: %v", err)
	}

	return nil
}

// development build
func (b *Builder) Develop(ctx context.Context, dir string, yield func(result Result)) error {
	_, err := b.RunScript(ctx, "develop")

	if err != nil {
		return fmt.Errorf("Develop process failed: %v", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("Failed to start watcher process: %v", err)
	}
	defer watcher.Close()

	if err = watcher.Add(dir); err != nil {
		return fmt.Errorf("Failed to watch directory %v, error: %v", dir, err)
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
	RunScript(ctx context.Context, script string, args ...string) (string, error)
}

type ScriptRunnerFunc func(ctx context.Context, script string, args ...string) (string, error)

func (f ScriptRunnerFunc) RunScript(ctx context.Context, script string, args ...string) (string, error) {
	stdout, err := f(ctx, script, args...)

	if err != nil {
		return "", err
	}

	return stdout, nil
}
