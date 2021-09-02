package build

import (
	"context"
	"log"
	"os/exec"
	"path/filepath"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/fsnotify/fsnotify"
)

func NewBuilder(extension core.Extension) *Builder {
	working_dir := filepath.Join(".", extension.Development.RootDir, extension.Development.BuildDir)
	pm := FindPackageManager(exec.LookPath, working_dir)
	return &Builder{pm, extension}
}

type Builder struct {
	ScriptRunner
	Extension core.Extension
}

type Result struct {
	Success bool
	Error   error
	UUID    string
}

// production build
func (b *Builder) Build(ctx context.Context, yield func(result Result)) {
	err := b.RunScript(ctx, "build")

	if err != nil {
		yield(Result{false, err, b.Extension.UUID})
		return
	}
	yield(Result{true, nil, b.Extension.UUID})
}

// development build
func (b *Builder) Develop(ctx context.Context, yield func(result Result)) {
	err := b.RunScript(ctx, "develop")

	if err != nil {
		yield(Result{false, err, b.Extension.UUID})
	}
}

func (b *Builder) Watch(ctx context.Context, yield func(result Result)) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		yield(Result{false, err, b.Extension.UUID})
	}
	defer watcher.Close()

	watch_dir := filepath.Join(".", b.Extension.Development.RootDir, b.Extension.Development.BuildDir)
	if err = watcher.Add(watch_dir); err != nil {
		yield(Result{false, err, b.Extension.UUID})
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("Terminating watcher")
			yield(Result{true, nil, b.Extension.UUID})
		case event := <-watcher.Events:
			if event.Op&fsnotify.Write == fsnotify.Write {
				log.Printf("file system event: %v\n", event)
				yield(Result{true, nil, b.Extension.UUID})
			}
		case err = <-watcher.Errors:
			log.Printf("file system error: %v\n", err)
			yield(Result{false, err, b.Extension.UUID})
		}
	}
}

type ScriptRunner interface {
	RunScript(ctx context.Context, script string, args ...string) error
}

type ScriptRunnerFunc func(ctx context.Context, script string, args ...string) error

func (f ScriptRunnerFunc) RunScript(ctx context.Context, script string, args ...string) error {
	return f(ctx, script, args...)
}
