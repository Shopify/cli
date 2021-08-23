package create

import (
	"bytes"
	"embed"
	"strings"
	"text/template"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create/fsUtils"
)

//go:embed templates/* templates/.shopify-cli.yml.tpl
var templates embed.FS
var templateRoot = "templates"
var templateFileExtension = ".tpl"
var defaultSourceDir = "src"

func NewExtensionProject(extension core.Extension) error {
	project := &project{
		&extension,
		fsUtils.NewFS(&templates, templateRoot),
		strings.ToUpper(extension.Type),
		strings.Contains(extension.Development.Template, "react"),
		strings.Contains(extension.Development.Template, "typescript"),
	}

	if err := fsUtils.MakeDir(extension.Development.RootDir); err != nil {
		return err
	}

	if err := project.createMainEntry(); err != nil {
		return err
	}

	if err := project.mergeTemplates(); err != nil {
		return err
	}

	return project.mergeYamlFiles()
}

func (project *project) createMainEntry() error {
	if err := fsUtils.MakeDir(fsUtils.JoinPaths(project.Development.RootDir, defaultSourceDir)); err != nil {
		return err
	}

	project.Development.Entry["main"] = fsUtils.JoinPaths(defaultSourceDir, project.getMainFileName())

	return project.fs.CopyFile(
		fsUtils.JoinPaths(project.Type, project.getMainTemplate()),
		fsUtils.JoinPaths(project.Development.RootDir, project.Development.Entry["main"]),
	)
}

func (project *project) mergeTemplates() error {
	return project.fs.Execute(&fsUtils.Operation{
		SourceDir:  "",
		TargetDir:  project.Development.RootDir,
		OnEachFile: project.executeTemplate,
	})
}

func (project *project) mergeYamlFiles() error {
	return project.fs.Execute(&fsUtils.Operation{
		SourceDir:  project.Type,
		TargetDir:  project.Development.RootDir,
		OnEachFile: project.joinYaml,
	})
}

func (project *project) joinYaml(filePath, targetPath string) error {
	if !strings.HasSuffix(targetPath, ".yml") {
		return nil
	}

	targetFile, err := fsUtils.OpenFileForAppend(targetPath)

	if err != nil {
		return project.fs.CopyFile(filePath, targetPath)
	}

	content, err := templates.ReadFile(filePath)
	if err != nil {
		return err
	}

	newContent := strings.Replace(string(content), "---", "", 1)

	if _, err = targetFile.WriteString(newContent); err != nil {
		return err
	}

	defer targetFile.Close()
	return nil
}

func (project *project) executeTemplate(filePath string, targetPath string) error {
	if !strings.HasSuffix(targetPath, templateFileExtension) {
		return nil
	}

	targetFilePath := strings.TrimSuffix(targetPath, templateFileExtension)

	content, err := project.mergeTemplateWithData(filePath)
	if err != nil {
		return err
	}

	formattedContent, err := fsUtils.FormatContent(targetFilePath, content.Bytes())
	if err != nil {
		return err
	}

	return fsUtils.CopyFileContent(targetFilePath, formattedContent)
}

func (project *project) mergeTemplateWithData(filePath string) (*bytes.Buffer, error) {
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

func (project *project) getMainFileName() string {
	if project.React && project.TypeScript {
		return "index.tsx"
	}

	if project.TypeScript {
		return "index.ts"
	}

	return "index.js"
}

func (project *project) getMainTemplate() string {
	if project.React {
		return "react.js"
	}
	return "javascript.js"
}

type project struct {
	*core.Extension
	fs            *fsUtils.FS
	FormattedType string
	React         bool
	TypeScript    bool
}
