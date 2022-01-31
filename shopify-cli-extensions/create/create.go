package create

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/core/fsutils"
	"github.com/Shopify/shopify-cli-extensions/create/process"
	"github.com/imdario/mergo"
	"gopkg.in/yaml.v3"
)

//go:embed templates/* templates/.shopify-cli.yml.tpl
var templates embed.FS

const (
	cliConfigYamlFile string = ".shopify-cli.yml"
	configYamlFile    string = "extension.config.yml"
	defaultBuildDir   string = "build"
	defaultSourceDir  string = "src"
	templateRoot      string = "templates"
	templateFileExt   string = ".tpl"
)

func NewExtensionProject(extension core.Extension) (err error) {
	fs := fsutils.NewFS(&templates, templateRoot)

	project := newProject(extension)

	setup := process.NewProcess(
		makeDir(extension.Development.RootDir),
		mergeGlobalTemplates(fs, project),
		mergeExtensionTemplates(fs, project),
		createSourceFiles(fs, project),
		mergeYamlAndJsonFiles(fs, project),
		installDependencies(extension.Development.RootDir),
	)

	return setup.Run()
}

func newProject(extension core.Extension) *project {
	project := &project{
		&extension,
		strings.ToUpper(extension.Type),
		strings.Contains(extension.Development.Template, "react"),
		strings.Contains(extension.Development.Template, "typescript"),
	}

	if project.Development.BuildDir == "" {
		project.Development.BuildDir = defaultBuildDir
	}

	if project.ExtensionPoints == nil {
		project.ExtensionPoints = make([]string, 0)
	}

	if project.Development.Entries == nil {
		project.Development.Entries = make(map[string]string)
		project.Development.Entries["main"] = filepath.Join(defaultSourceDir, getMainFileName(project))
	}
	return project
}

func makeDir(path string) process.Task {
	return process.Task{
		Run: func() error {
			return fsutils.MakeDir(path)
		},
		Undo: func() error {
			return fsutils.RemoveDir(path)
		},
	}
}

func createSourceFiles(fs *fsutils.FS, project *project) process.Task {
	sourceDirPath := filepath.Join(project.Development.RootDir, defaultSourceDir)

	return process.Task{
		Run: func() (err error) {
			if err := fsutils.MakeDir(sourceDirPath); err != nil {
				return err
			}

			// This extension has a template file for index.js.tpl which has already been merged with data
			// We just need to move the file to the src directory main path
			mainTemplateFilePath := filepath.Join(project.Type, fmt.Sprintf("index.js%s", templateFileExt))
			if fs.FileExists(mainTemplateFilePath) {
				err = os.Rename(filepath.Join(project.Development.RootDir, "index.js"), filepath.Join(project.Development.RootDir, project.Development.Entries["main"]))
				if err != nil {
					return
				}
			} else {
				// Create main index file
				err = fs.CopyFile(filepath.Join(project.Type, getMainTemplate(project)),
					filepath.Join(project.Development.RootDir, project.Development.Entries["main"]),
				)

				if err != nil {
					return
				}
			}

			additionalSrcFilePath := filepath.Join(project.Type, defaultSourceDir)

			if !fs.FileExists(additionalSrcFilePath) {
				return
			}

			// Copy additional files inside template source
			err = fs.Execute(&fsutils.Operation{
				SourceDir: additionalSrcFilePath,
				TargetDir: sourceDirPath,
				OnEachFile: func(filePath, targetPath string) (err error) {
					return fs.CopyFile(
						filePath,
						targetPath,
					)
				},
				Recursive: true,
			})
			return
		},
		Undo: func() error {
			// TODO: Figure out if we should recursively remove all files inside src or not
			return fsutils.RemoveDir(sourceDirPath)
		},
	}
}

func mergeGlobalTemplates(fs *fsutils.FS, project *project) process.Task {
	return mergeTemplates(fs, project, &fsutils.Operation{
		SourceDir: "",
		TargetDir: project.Development.RootDir,
	})
}

func mergeExtensionTemplates(fs *fsutils.FS, project *project) process.Task {
	return mergeTemplates(fs, project, &fsutils.Operation{
		SourceDir: project.Type,
		TargetDir: project.Development.RootDir,
		Recursive: true,
	})
}

func mergeTemplates(fs *fsutils.FS, project *project, op *fsutils.Operation) process.Task {
	newFilePaths := make([]string, 0)
	op.OnEachFile = func(filePath, targetPath string) (err error) {
		if !strings.HasSuffix(targetPath, templateFileExt) {
			return
		}

		targetFilePath := strings.TrimSuffix(targetPath, templateFileExt)

		content, err := fs.MergeTemplateData(project, filePath)

		if err != nil {
			return
		}

		formattedContent, err := formatContent(targetFilePath, content.Bytes())
		if err != nil {
			return
		}

		newFilePaths = append(newFilePaths, targetFilePath)
		return fsutils.CopyFileContent(targetFilePath, formattedContent)
	}

	return process.Task{
		Run: func() error {
			return fs.Execute(op)
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

func mergeYamlAndJsonFiles(fs *fsutils.FS, project *project) process.Task {
	filesToRestore := make([]files, 0)
	return process.Task{
		Run: func() error {
			return fs.Execute(&fsutils.Operation{
				SourceDir: project.Type,
				TargetDir: project.Development.RootDir,
				OnEachFile: func(filePath, targetPath string) (err error) {
					if !strings.HasSuffix(targetPath, fsutils.JSON) && !strings.HasSuffix(targetPath, fsutils.YAML) {
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

					if err != nil {
						return
					}

					if err = os.WriteFile(targetPath, formattedContent, 0600); err != nil {
						return
					}

					return
				},
				Recursive: true,
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
	if strings.HasSuffix(targetPath, fsutils.YAML) {
		if strings.HasSuffix(targetPath, configYamlFile) {
			return mergeConfigYaml(targetPath, originalContent, newContent, fs)
		} else {
			content, err = concatYaml(originalContent, newContent, fs)
			if err != nil {
				return
			}
		}
	} else if strings.HasSuffix(targetPath, fsutils.JSON) {
		content, err = mergeJson(originalContent, newContent, fs)
		if err != nil {
			return
		}
	}

	content, err = formatContent(targetPath, content)
	return
}

func mergeConfigYaml(targetPath string, originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	content, err = mergeYaml(originalContent, newContent, fs)
	if err != nil {
		return
	}

	content, err = formatContent(targetPath, content)

	// TODO: Improve this logic to get comments. Currently we just append them to the file
	content = append(content, appendComments(originalContent)...)
	content = append(content, appendComments(newContent)...)

	return
}

func concatYaml(originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	originalStr := string(originalContent)
	newStr := strings.Replace(string(newContent), "---", "", 1)

	content = []byte(originalStr)
	content = append(content, []byte(newStr)...)
	return
}

func mergeYaml(originalContent []byte, newContent []byte, fs *fsutils.FS) (content []byte, err error) {
	orgConfig := core.Extension{}
	err = yaml.Unmarshal(originalContent, &orgConfig)
	if err != nil {
		return
	}

	newConfig := core.Extension{}
	err = yaml.Unmarshal(newContent, &newConfig)
	if err != nil {
		return
	}

	err = mergo.Merge(&orgConfig, &newConfig)
	if err != nil {
		return
	}

	content, err = yaml.Marshal(&orgConfig)
	return
}

func appendComments(additionalContent []byte) (content []byte) {
	re := regexp.MustCompile(`(?m)\# (.+)\n`)
	matches := re.FindAllString(string(additionalContent), -1)

	for _, m := range matches {
		content = append(content, []byte(m)...)
	}
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

func formatContent(targetPath string, content []byte) ([]byte, error) {
	if strings.HasSuffix(targetPath, fsutils.JSON) {
		return formatJSON(content)
	}

	if strings.HasSuffix(targetPath, fsutils.YAML) {
		return formatYaml(content, targetPath)
	}
	return content, nil
}

func formatJSON(bytes []byte) ([]byte, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return nil, err
	}
	return json.MarshalIndent(result, "", "  ")
}

func formatYaml(unformattedContent []byte, targetPath string) (content []byte, err error) {
	var b bytes.Buffer
	var config interface{}

	if strings.HasSuffix(targetPath, cliConfigYamlFile) {
		config = shopifyCLIYML{}
	} else if strings.HasSuffix(targetPath, configYamlFile) {
		config = core.Extension{}
	} else {
		return
	}

	err = yaml.Unmarshal(unformattedContent, &config)

	if err != nil {
		return
	}

	yamlEncoder := yaml.NewEncoder(&b)
	yamlEncoder.SetIndent(2)
	yamlEncoder.Encode(&config)

	content = []byte("---\n")
	content = append(content, b.Bytes()...)
	return
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
	Name            string            `json:"name"`
	DevDependencies map[string]string `json:"devDependencies"`
	Dependencies    map[string]string `json:"dependencies"`
	License         string            `json:"license"`
	Scripts         map[string]string `json:"scripts"`
}

type shopifyCLIYML struct {
	ProjectType    string `yaml:"project_type"`
	OrganizationId string `yaml:"organization_id"`
	ExtensionType  string `yaml:"EXTENSION_TYPE"`
}

var LookPath = exec.LookPath
var Command = func(dir, executable string, args ...string) (runner Runner) {
	cmd := exec.Command(executable, args...)
	cmd.Dir = dir
	return cmd
}

type Runner interface {
	Run() error
}

func installDependencies(path string) process.Task {
	return process.Task{
		Run: func() error {
			var package_manager string
			if yarn, err := LookPath("yarn"); err == nil {
				package_manager = yarn
			} else if npm, err := LookPath("npm"); err == nil {
				package_manager = npm
			} else {
				return errors.New("Package manager not found")
			}

			err := Command(path, package_manager).Run()
			if err != nil {
				return err
			}
			return nil
		},
		Undo: func() error {
			cmd := exec.Command("rm", "-rf", "node_modules")
			cmd.Dir = path
			if err := cmd.Run(); err != nil {
				return err
			}
			return nil
		},
	}
}
