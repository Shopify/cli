package create

import (
	"bytes"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create/fsutils"
)

//go:embed templates/* templates/.shopify-cli.yml.tpl
var templates embed.FS
var templateRoot = "templates"
var templateFileExtension = ".tpl"
var defaultSourceDir = "src"

func NewExtensionProject(extension core.Extension) (err error) {
	fs := fsutils.NewFS(&templates, templateRoot)
	project := &project{
		&extension,
		strings.ToUpper(extension.Type),
		strings.Contains(extension.Development.Template, "react"),
		strings.Contains(extension.Development.Template, "typescript"),
	}

	setup := NewProcess(
		MakeDir(extension.Development.BuildDir),
		CreateMainEntry(fs, project),
		MergeTemplates(fs, project),
		MergeYamlFiles(fs, project),
	)

	return setup.Run()
}

type Task struct {
	Run  func() error
	Undo func() error
}

func NewProcess(tasks ...Task) Process {
	return Process{
		tasks:  tasks,
		status: make([]string, len(tasks)),
	}
}

func MakeDir(path string) Task {
	return Task{
		Run: func() error {
			return fsutils.MakeDir(path)
		},
		Undo: func() error {
			return fsutils.RemoveDir(path)
		},
	}
}

func CreateMainEntry(fs *fsutils.FS, project *project) Task {
	filePath := filepath.Join(project.Development.RootDir, defaultSourceDir)
	mainFile := getMainFileName(project)

	return Task{
		Run: func() error {
			if err := fsutils.MakeDir(filePath); err != nil {
				return err
			}

			project.Development.Entries["main"] = filepath.Join(defaultSourceDir, mainFile)

			return fs.CopyFile(
				filepath.Join(project.Type, getMainTemplate(project)),
				filepath.Join(project.Development.RootDir, project.Development.Entries["main"]),
			)
		},
		Undo: func() error {
			return fsutils.RemoveDir(filePath)
		},
	}
}

func MergeTemplates(fs *fsutils.FS, project *project) Task {
	newFilePaths := make([]string, 0)
	return Task{
		Run: func() error {
			return fs.Execute(&fsutils.Operation{
				SourceDir: "",
				TargetDir: project.Development.RootDir,
				OnEachFile: func(filePath, targetPath string) (err error) {
					if !strings.HasSuffix(targetPath, templateFileExtension) {
						return
					}

					targetFilePath := strings.TrimSuffix(targetPath, templateFileExtension)

					content, err := mergeTemplateWithData(project, filePath)
					if err != nil {
						return
					}

					formattedContent, err := fsutils.FormatContent(targetFilePath, content.Bytes())
					if err != nil {
						return
					}
					newFilePaths = append(newFilePaths, targetFilePath)
					return fsutils.CopyFileContent(targetFilePath, formattedContent)
				},
			})
		},
		Undo: func() (err error) {
			for _, filePath := range newFilePaths {
				if err = os.Remove(filePath); err != nil {
					return
				}
			}
			return
		},
	}
}

type files struct {
	content  string
	filePath string
}

func MergeYamlFiles(fs *fsutils.FS, project *project) Task {
	filesToRestore := make([]files, 0)
	return Task{
		Run: func() error {
			return fs.Execute(&fsutils.Operation{
				SourceDir: project.Type,
				TargetDir: project.Development.RootDir,
				OnEachFile: func(filePath, targetPath string) (err error) {
					if !strings.HasSuffix(targetPath, ".yml") {
						return
					}

					targetFile, err := fsutils.OpenFileForAppend(targetPath)

					if err != nil {
						return fs.CopyFile(filePath, targetPath)
					}

					content, err := templates.ReadFile(filePath)
					if err != nil {
						return
					}

					oldContent, err := os.ReadFile(targetPath)

					if err != nil {
						return
					}

					filesToRestore = append(filesToRestore, files{string(oldContent), targetPath})

					newContent := strings.Replace(string(content), "---", "", 1)

					if _, err = targetFile.WriteString(newContent); err != nil {
						_, err = targetFile.Write(oldContent)
						return
					}

					defer targetFile.Close()
					return
				},
			})
		},
		Undo: func() (err error) {
			for _, file := range filesToRestore {
				return os.WriteFile(file.filePath, []byte(file.content), 0600)
			}
			return
		},
	}
}

type Process struct {
	tasks  []Task
	status []string
}

func (p *Process) Run() (err error) {
	for taskId, task := range p.tasks {
		if err = task.Run(); err != nil {
			p.status[taskId] = "fail"
			if undoErr := p.Undo(); undoErr != nil {
				fmt.Printf("Failed to undo with error: %v\n", undoErr)
			}
			return
		}
		p.status[taskId] = "success"
	}
	return
}

func (p *Process) Undo() (err error) {
	for taskId := range p.status {
		taskId = len(p.status) - 1 - taskId
		if p.status[taskId] == "fail" {
			return p.tasks[taskId].Undo()
		}
	}
	return
}

func mergeTemplateWithData(project *project, filePath string) (*bytes.Buffer, error) {
	var templateContent bytes.Buffer
	content, err := templates.ReadFile(filePath)
	if err != nil {
		return &templateContent, err
	}

	fileTemplate := template.New(filePath)
	fileTemplate, err = fileTemplate.Parse(string(content))
	if err != nil {
		return &templateContent, err
	}

	if err = fileTemplate.Execute(&templateContent, project); err != nil {
		return &templateContent, err
	}

	return &templateContent, nil
}

func getMainFileName(project *project) string {
	if project.React && project.TypeScript {
		return "index.tsx"
	}

	if project.TypeScript {
		return "index.ts"
	}

	return "index.js"
}

func getMainTemplate(project *project) string {
	if project.React {
		return "react.js"
	}
	return "javascript.js"
}

type project struct {
	*core.Extension
	FormattedType string
	React         bool
	TypeScript    bool
}
