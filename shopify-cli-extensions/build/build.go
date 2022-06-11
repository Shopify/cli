package build

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
	"gopkg.in/yaml.v3"

	"text/template"
)

const nextStepsTemplatePath = "templates/shared/%s/next-steps.txt"
const rwxr_xr_x = 0755

func Build(extension core.Extension, report ResultHandler) {
	var err error
	var command *exec.Cmd
	if extension.NodeExecutable != "" {
		command = nodeExecutableScript(extension.Development.RootDir, extension.NodeExecutable, "build")
	} else {
		command, err = script(extension.BuildDir(), "build")
	}
	if err != nil {
		report(Result{false, err.Error(), extension})
		return
	}

	if err := configureScript(command, extension); err != nil {
		report(Result{false, err.Error(), extension})
	}
	ensureBuildDirectoryExists(extension)

	output, err := command.CombinedOutput()
	if err != nil {
		report(Result{false, string(output), extension})
		return
	}

	if err := verifyAssets(extension); err != nil {
		report(Result{false, err.Error(), extension})
		return
	}

	report(Result{true, string(output), extension})
}

func reportAndUpdateDevelopmentStatus(result Result, report ResultHandler) {
	extension := result.Extension
	if result.Success {
		result.Extension.Development.Status = "success"
		// Recreate the asset struct otherwise we will have data leakage from previous results
		result.Extension.Assets = core.CreateAssetsEntries(&extension)

		for entry := range result.Extension.Assets {
			result.Extension.Assets[entry] = core.Asset{
				Name:        extension.Assets[entry].Name,
				LastUpdated: time.Now().Unix(),
			}
		}
	} else {
		result.Extension.Development.Status = "error"
	}

	report(result)
}

func Watch(extension core.Extension, integrationCtx core.IntegrationContext, report ResultHandler) {
	var err error
	var command *exec.Cmd
	if extension.NodeExecutable != "" {
		command = nodeExecutableScript(extension.Development.RootDir, extension.NodeExecutable, "develop")
	} else {
		command, err = script(extension.BuildDir(), "develop")
	}
	if err != nil {
		reportAndUpdateDevelopmentStatus(Result{false, err.Error(), extension}, report)
		return
	}

	stdout, _ := command.StdoutPipe()
	stderr, _ := command.StderrPipe()

	if err := configureScript(command, extension); err != nil {
		reportAndUpdateDevelopmentStatus(Result{false, err.Error(), extension}, report)
	}
	ensureBuildDirectoryExists(extension)

	command.Start()

	logProcessors := sync.WaitGroup{}
	logProcessors.Add(2)

	templateBytes, _ := create.ReadTemplateFile(fmt.Sprintf(nextStepsTemplatePath, strings.ToLower(extension.Type)))

	go processLogs(stdout, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			if err := verifyAssets(extension); err != nil {
				reportAndUpdateDevelopmentStatus(Result{false, err.Error(), extension}, report)
			} else {
				reportAndUpdateDevelopmentStatus(Result{true, message, extension}, report)
				if len(templateBytes) > 0 {
					fmt.Fprintf(os.Stdout, "%s\n", generateNextSteps(string(templateBytes), extension, integrationCtx))
					templateBytes = nil
				}
			}
		},
	})

	go processLogs(stderr, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			reportAndUpdateDevelopmentStatus(Result{false, message, extension}, report)
		},
	})

	command.Wait()
	logProcessors.Wait()
}

// Builds 'Next Steps'
func generateNextSteps(rawTemplate string, ext core.Extension, ctx core.IntegrationContext) string {
	type contextRoot struct { // Wraps top-level elements, allowing them to be referenced in next-steps.txt
		core.Extension
		core.IntegrationContext
	}

	var buf bytes.Buffer

	templ := template.New("templ")
	templ, err := templ.Parse(rawTemplate)
	if err == nil {
		contextRoot := contextRoot{ext, ctx}
		templ.Execute(&buf, contextRoot)
	}

	return buf.String()
}

type ResultHandler func(result Result)

func ensureBuildDirectoryExists(ext core.Extension) {
	if _, err := os.Stat(ext.BuildDir()); errors.Is(err, os.ErrNotExist) {
		os.MkdirAll(ext.BuildDir(), rwxr_xr_x)
	}
}

func configureScript(script *exec.Cmd, extension core.Extension) error {
	// "Next" extensions are executed from the root directory of the project,
	// not the root directory of the extension itself. Hence paths must be
	// prefaced by the extension's root_dir in arguments to the executable.
	//
	// However, this prefacing breaks the Go code, so we need to do it
	// non-destructively.
	if extension.UsesNext() {
		development := extension.Development
		development.BuildDir = extension.BuildDir()
		entries := development.Entries
		for handle, path := range entries {
			entries[handle] = filepath.Join(".", extension.Development.RootDir, path)
		}
		development.Entries = entries
		extension.Development = development
	}
	data, err := yaml.Marshal(extension)
	if err != nil {
		return fmt.Errorf("unable to serialize extension configuration information: %w", err)
	}
	script.Stdin = bytes.NewReader(data)
	return nil
}
