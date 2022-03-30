package create

import (
	"path/filepath"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
)

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

type project struct {
	*core.Extension
	FormattedType string
	React         bool
	TypeScript    bool
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
