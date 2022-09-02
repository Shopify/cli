package create

import (
	"embed"
	"html/template"
	"io"
	"io/fs"
	"os"
	"path"

	"github.com/Shopify/shopify-cli-extensions/core"
)

//go:embed templates/* templates/projects/**/*
var templates embed.FS

type CreateProject core.Extension

func (e CreateProject) Run() error {
	extension := core.Extension(e)
	shared, _ := fs.Sub(templates, "templates/shared")
	project, _ := fs.Sub(templates, path.Join("templates/projects", extension.Type))

	engine := NewTemplateEngine(extension, FS{shared}, FS{project})
	return engine.createProject()
}

func (ext CreateProject) Undo() error {
	return nil
}

// MakeDir is a process.Task that creates a directory.
type MakeDir string

func (path MakeDir) Run() error {
	return os.MkdirAll(string(path), 0755)
}

func (path MakeDir) Undo() error {
	return os.Remove(string(path))
}

type RenderTask struct {
	Source    *SourceFileReference
	Target    *TargetFileReference
	Extension core.Extension
	*template.Template
}

func (t RenderTask) Run() error {
	rule := LookupRule(t.Extension, t.Source, t.Target)
	target := rule(t.Extension, t.Source, t.Target)

	return target.Open(func(w io.Writer) error {
		return t.ExecuteTemplate(w, t.Source.Path(), t.Extension)
	})
}

func (t RenderTask) Undo() error {
	return nil
}

type CopyFileTask struct {
	Source *SourceFileReference
	Target *TargetFileReference
}

func (t CopyFileTask) Run() error {
	return t.Target.Open(func(w io.Writer) error {
		return t.Source.Open(func(r io.Reader) error {
			_, err := io.Copy(w, r)
			return err
		})
	})
}

func (t CopyFileTask) Undo() error {
	return nil
}
