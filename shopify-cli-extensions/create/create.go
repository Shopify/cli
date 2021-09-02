package create

import (
	"bytes"
	"embed"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create/fsutils"
	"github.com/Shopify/shopify-cli-extensions/create/process"
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

	setup := process.NewProcess(
		MakeDir(extension.Development.RootDir),
		CreateSourceFiles(fs, project),
		MergeTemplates(fs, project),
		MergeYamlAndJsonFiles(fs, project),
	)

	return setup.Run()
}

func MakeDir(path string) process.Task {
	return process.Task{
		Run: func() error {
			return fsutils.MakeDir(path)
		},
		Undo: func() error {
			return fsutils.RemoveDir(path)
		},
	}
}

func CreateSourceFiles(fs *fsutils.FS, project *project) process.Task {
	sourceDirPath := filepath.Join(project.Development.RootDir, defaultSourceDir)

	return process.Task{
		Run: func() (err error) {
			if err := fsutils.MakeDir(sourceDirPath); err != nil {
				return err
			}

			project.Development.Entries = make(map[string]string)
			project.Development.Entries["main"] = filepath.Join(defaultSourceDir, getMainFileName(project))

			// Create main index file
			err = fs.CopyFile(
				filepath.Join(project.Type, getMainTemplate(project)),
				filepath.Join(project.Development.RootDir, project.Development.Entries["main"]),
			)

			if err != nil {
				return
			}

			// Copy additional files inside template source
			err = fs.Execute(&fsutils.Operation{
				SourceDir: filepath.Join(project.Type, defaultSourceDir),
				TargetDir: sourceDirPath,
				OnEachFile: func(filePath, targetPath string) (err error) {
					return fs.CopyFile(
						filePath,
						targetPath,
					)
				},
				SkipEmpty: true,
			})
			return
		},
		Undo: func() error {
			// TODO: Figure out if we should recursively remove all files inside src or not
			return fsutils.RemoveDir(sourceDirPath)
		},
	}
}

func MergeTemplates(fs *fsutils.FS, project *project) process.Task {
	newFilePaths := make([]string, 0)
	return process.Task{
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
				SkipEmpty: false,
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

func MergeYamlAndJsonFiles(fs *fsutils.FS, project *project) process.Task {
	filesToRestore := make([]files, 0)
	return process.Task{
		Run: func() error {
			return fs.Execute(&fsutils.Operation{
				SourceDir: project.Type,
				TargetDir: project.Development.RootDir,
				OnEachFile: func(filePath, targetPath string) (err error) {
					if !strings.HasSuffix(targetPath, ".json") && !strings.HasSuffix(targetPath, ".yml") {
						return
					}

					targetFile, openErr := fsutils.OpenFileForAppend(targetPath)

					if openErr != nil {
						return fs.CopyFile(filePath, targetPath)
					}

					defer targetFile.Close()

					newContent, err := templates.ReadFile(filePath)
					if err != nil {
						return
					}

					originalContent, err := os.ReadFile(targetPath)

					if err != nil {
						return
					}

					filesToRestore = append(filesToRestore, files{originalContent, targetPath})
					formattedContent, err := getFormattedMergedContent(targetPath, originalContent, newContent, fs)

					if err = os.WriteFile(targetPath, formattedContent, 0600); err != nil {
						return
					}

					return
				},
				SkipEmpty: false,
			})
		},
		Undo: func() (err error) {
			for _, file := range filesToRestore {
				return os.WriteFile(file.filePath, file.content, 0600)
			}
			return
		},
	}
}

func getFormattedMergedContent(targetPath string, originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	if strings.HasSuffix(targetPath, ".yml") {
		content, err = mergeYaml(originalContent, newContent, fs)
		if err != nil {
			return
		}
	} else if strings.HasSuffix(targetPath, ".json") {
		content, err = mergeJson(originalContent, newContent, fs)
		if err != nil {
			return
		}
	}

	content, err = fsutils.FormatContent(targetPath, content)
	return
}

func mergeYaml(originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	originalStr := string(originalContent)
	// TODO: Actually merge the YAML
	newStr := strings.Replace(string(newContent), "---", "", 1)

	content = []byte(originalStr)
	content = append(content, []byte(newStr)...)
	return
}

func mergeJson(originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	var result packageJSON
	var newResult packageJSON
	if err = json.Unmarshal(originalContent, &result); err != nil {
		return
	}

	if err = json.Unmarshal(newContent, &newResult); err != nil {
		return
	}

	for k, v := range newResult.Dependencies {
		result.Dependencies[k] = v
	}
	for k, v := range newResult.DevDependencies {
		result.DevDependencies[k] = v
	}

	content, err = json.Marshal(result)

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

type files struct {
	content  []byte
	filePath string
}

type packageJSON struct {
	DevDependencies map[string]string `json:"devDependencies"`
	Dependencies    map[string]string `json:"dependencies"`
	License         string            `json:"license"`
	Scripts         map[string]string `json:"scripts"`
}
