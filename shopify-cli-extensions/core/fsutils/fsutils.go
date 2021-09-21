package fsutils

import (
	"bytes"
	"embed"
	"encoding/json"
	"html/template"
	"io"
	"os"
	"path/filepath"
	"strings"
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

func (fs *FS) Execute(op *Operation) error {
	dirPath := fs.root
	if op.SourceDir != "" {
		dirPath = filepath.Join(fs.root, op.SourceDir)
	}

	entries, readDirErr := fs.ReadDir(dirPath)

	if readDirErr != nil && !op.SkipEmpty {
		return readDirErr
	}

	for _, entry := range entries {
		fileName := entry.Name()

		if entry.IsDir() {
			relativeDir := fileName
			if op.SourceDir != "" {
				relativeDir = filepath.Join(op.SourceDir, fileName)
			}

			if err := fs.Execute(&Operation{
				SourceDir:  relativeDir,
				TargetDir:  op.TargetDir,
				OnEachFile: op.OnEachFile,
			}); err != nil {
				return err
			}
		} else {
			filePath := filepath.Join(dirPath, fileName)
			targetPath := filepath.Join(op.TargetDir, fileName)

			if err := op.OnEachFile(filePath, targetPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func (fs *FS) MergeTemplateData(templateData interface{}, filePath string) (*bytes.Buffer, error) {
	var templateContent bytes.Buffer
	content, err := fs.ReadFile(fs.normalizePath(filePath))
	if err != nil {
		return &templateContent, err
	}

	fileTemplate := template.New(filePath)
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

func FormatContent(targetPath string, content []byte) ([]byte, error) {
	if strings.HasSuffix(targetPath, ".json") {
		return FormatJSON(content)
	}

	return content, nil
}

func FormatJSON(bytes []byte) ([]byte, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return nil, err
	}
	return json.MarshalIndent(result, "", "  ")
}

func MakeDir(dirPath string) error {
	return os.MkdirAll(dirPath, 0755)
}

func RemoveDir(dirPath string) error {
	return os.Remove(dirPath)
}

func OpenFileForAppend(filePath string) (*os.File, error) {
	return os.OpenFile(filePath, os.O_APPEND|os.O_WRONLY, 0600)
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
	SkipEmpty  bool
}

type OnEachFile func(filePath string, targetPath string) error

type FS struct {
	*embed.FS
	root string
}
