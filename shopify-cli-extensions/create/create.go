package create

import (
	"embed"
	"os/exec"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/core/fsutils"
	"github.com/Shopify/shopify-cli-extensions/create/process"
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

func ReadTemplateFile(path string) ([]byte, error) {
	return templates.ReadFile(path)
}

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

var LookPath = exec.LookPath
var Command = func(dir, executable string, args ...string) (runner Runner) {
	cmd := exec.Command(executable, args...)
	cmd.Dir = dir
	return cmd
}

type Runner interface {
	Run() error
	CombinedOutput() ([]byte, error)
}
