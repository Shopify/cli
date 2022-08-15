package create

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type FS struct {
	fs.FS
}

func (_fs FS) WalkDir(walk WalkDirFunc) error {
	return fs.WalkDir(_fs.FS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return fmt.Errorf("unable to traverse file system: %w", err)
		}

		return walk(NewSourceFileReference(_fs.FS, path))
	})
}

type WalkDirFunc func(ref *SourceFileReference) error

func NewSourceFileReference(fs fs.FS, path ...string) *SourceFileReference {
	return &SourceFileReference{fs, UniversalPath(path...)}
}

type SourceFileReference struct {
	fs.FS
	universalPath
}

func (r *SourceFileReference) Open(read ReaderFunc) error {
	file, err := r.FS.Open(r.Path())
	if err != nil {
		return err
	}
	defer file.Close()

	return read(file)
}

type ReaderFunc func(r io.Reader) error

func (r *SourceFileReference) IsDir() bool {
	fileInfo, err := fs.Stat(r.FS, r.Path())
	if err != nil {
		panic(err)
	}
	return fileInfo.IsDir()
}

func (r *SourceFileReference) IsTemplate() bool {
	return !r.IsDir() && strings.HasSuffix(r.Path(), ".tpl")
}

func (r *SourceFileReference) InferTarget(projectDir string) *TargetFileReference {
	targetPath := r.Path()

	if r.IsTemplate() {
		targetPath = strings.TrimSuffix(targetPath, ".tpl")
	}

	return NewTargetFileReference(os.DirFS("."), projectDir, targetPath)
}

func NewTargetFileReference(fs fs.FS, path ...string) *TargetFileReference {
	return &TargetFileReference{fs, UniversalPath(path...)}
}

type TargetFileReference struct {
	fs.FS
	universalPath
}

func (r *TargetFileReference) Open(write WriterFunc) (err error) {
	// The path to the target file has to be OS specific meaning seprated by / for
	// Linux and Unix system and \ for Windows. Hence, we need to call FilePath()
	// instead of Path().
	file, err := os.Create(r.FilePath())
	if err != nil {
		return fmt.Errorf("unable to create target file %s: %w", r.FilePath(), err)
	}
	defer file.Close()
	return write(file)
}

func (r *TargetFileReference) Rename(name string) *TargetFileReference {
	return &TargetFileReference{r.FS, r.universalPath.Rename(name)}
}

func UniversalPath(paths ...string) universalPath {
	fragments := make([]string, 0)
	for _, fragment := range paths {
		fragments = append(fragments, strings.Split(fragment, "/")...)
	}
	return universalPath(fragments)
}

type universalPath []string

func (p universalPath) Path() string {
	return path.Join(p...)
}

func (p universalPath) FilePath() string {
	return filepath.Join(p...)
}

func (p universalPath) Rename(name string) universalPath {
	return append(p[0:len(p)-1], name)
}

type WriterFunc func(w io.Writer) error
