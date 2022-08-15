package fsutils

import (
	"bytes"
	"embed"
	"html/template"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	JSON string = ".json"
	YAML string = ".yml"
)

func NewFS(embeddedFS *embed.FS, root string) *FS {
	return &FS{
		embeddedFS,
		root,
	}
}

func (fs *FS) FileExists(filePath string) bool {
	normalizedPath := fs.normalizePath(filePath)
	file, err := fs.Open(normalizedPath)
	if err != nil {
		return false
	}
	file.Close()
	return true
}

func (fs *FS) CopyFile(filePath, targetPath string) error {
	content, err := fs.ReadFile(fs.normalizePath(filePath))
	if err != nil {
		return err
	}
	return CopyFileContent(targetPath, content)
}

func (fs *FS) Execute(op *Operation) (err error) {
	dirPath := fs.root
	if op.SourceDir != "" {
		dirPath = filepath.Join(fs.root, op.SourceDir)
	}

	entries, err := fs.ReadDir(dirPath)

	if err != nil {
		return
	}

	for _, entry := range entries {
		fileName := entry.Name()
		if entry.IsDir() {
			if !op.Recursive {
				continue
			}

			relativeDir := fileName
			if op.SourceDir != "" {
				relativeDir = filepath.Join(op.SourceDir, fileName)
			}

			if err = fs.Execute(&Operation{
				SourceDir:  relativeDir,
				TargetDir:  filepath.Join(op.TargetDir, fileName),
				OnEachFile: op.OnEachFile,
			}); err != nil {
				return
			}
		} else {
			filePath := filepath.Join(dirPath, fileName)
			targetPath := filepath.Join(op.TargetDir, fileName)

			if err = op.OnEachFile(filePath, targetPath); err != nil {
				return
			}
		}
	}
	return
}

func (fs *FS) MergeTemplateData(templateData interface{}, filePath string) (*bytes.Buffer, error) {
	var templateContent bytes.Buffer
	content, err := fs.ReadFile(fs.normalizePath(filePath))
	if err != nil {
		return &templateContent, err
	}

	fileTemplate := template.New(filePath)
	fileTemplate.Funcs(templateHelpers)
	fileTemplate, err = fileTemplate.Parse(string(content))
	if err != nil {
		return &templateContent, err
	}

	if err = fileTemplate.Execute(&templateContent, templateData); err != nil {
		return &templateContent, err
	}

	return &templateContent, nil
}

func CopyFileContent(targetPath string, content []byte) error {
	file, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := io.Copy(file, bytes.NewReader(content)); err != nil {
		return err
	}

	return nil
}

func OpenFileForAppend(filePath string) (*os.File, error) {
	return os.OpenFile(filePath, os.O_APPEND|os.O_WRONLY, 0600)
}

func (fs *FS) ReadTemplateFile(filePath string) ([]byte, error) {
	return fs.ReadFile(fs.normalizePath(filePath))
}

func (fs *FS) normalizePath(filePath string) string {
	if strings.HasPrefix(filePath, fs.root+"/") {
		return filePath
	}
	return filepath.Join(fs.root, filePath)
}

type Operation struct {
	SourceDir  string
	TargetDir  string
	OnEachFile OnEachFile
	Recursive  bool
}

type OnEachFile func(filePath string, targetPath string) error

type FS struct {
	*embed.FS
	root string
}

var templateHelpers template.FuncMap = template.FuncMap{
	"raw": func(value string) template.HTML {
		return template.HTML(value)
	},
}
