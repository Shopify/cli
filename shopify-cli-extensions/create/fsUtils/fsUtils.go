package fsUtils

import (
	"bytes"
	"embed"
	"encoding/json"
	"io"
	"os"
	"strings"
)

func NewFS(embeddedFS *embed.FS, root string) *FS {
	return &FS{
		embeddedFS,
		root,
	}
}

func (fs *FS) CopyFile(filePath, targetPath string) error {
	content, err := fs.embeddedFS.ReadFile(JoinPaths(fs.root, filePath))
	if err != nil {
		return err
	}
	return CopyFileContent(targetPath, content)
}

func (fs *FS) Execute(op *Operation) error {
	dirPath := fs.root
	if op.SourceDir != "" {
		dirPath = JoinPaths(fs.root, op.SourceDir)
	}

	entries, err := fs.embeddedFS.ReadDir(dirPath)

	if err != nil {
		return err
	}

	for _, entry := range entries {
		fileName := entry.Name()

		if entry.IsDir() {
			relativeDir := fileName
			if op.SourceDir != "" {
				relativeDir = JoinPaths(op.SourceDir, fileName)
			}

			if err := fs.Execute(&Operation{
				SourceDir:  relativeDir,
				TargetDir:  op.TargetDir,
				OnEachFile: op.OnEachFile,
			}); err != nil {
				return err
			}
		} else {
			filePath := JoinPaths(dirPath, fileName)
			targetPath := JoinPaths(op.TargetDir, fileName)

			if err := op.OnEachFile(filePath, targetPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func CopyFileContent(targetPath string, content []byte) error {
	file, err := os.Create(targetPath)
	if err != nil {
		return err
	}

	if _, err := io.Copy(file, bytes.NewReader(content)); err != nil {
		return err
	}

	defer file.Close()

	return nil
}

func JoinPaths(args ...string) string {
	return strings.Join(append([]string{}, args...), "/")
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

func OpenFileForAppend(filePath string) (*os.File, error) {
	return os.OpenFile(filePath, os.O_APPEND|os.O_WRONLY, 0600)
}

type Operation struct {
	SourceDir  string
	TargetDir  string
	OnEachFile OnEachFile
}

type OnEachFile func(filePath string, targetPath string) error

type FS struct {
	embeddedFS *embed.FS
	root       string
}
