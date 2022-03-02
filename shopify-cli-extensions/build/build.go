package build

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
	"gopkg.in/yaml.v3"
)

const nextStepsTemplatePath = "templates/%s/next-steps.txt"

func Build(extension core.Extension, report ResultHandler) {
	script, err := script(extension.BuildDir(), "build")
	if err != nil {
		report(Result{false, err.Error(), extension})
		return
	}

	if err := configureScript(script, extension); err != nil {
		report(Result{false, err.Error(), extension})
	}
	ensureBuildDirectoryExists(extension)

	output, err := script.CombinedOutput()
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

func Watch(extension core.Extension, report ResultHandler) {
	script, err := script(extension.BuildDir(), "develop")
	if err != nil {
		report(Result{false, err.Error(), extension})
		return
	}

	stdout, _ := script.StdoutPipe()
	stderr, _ := script.StderrPipe()

	if err := configureScript(script, extension); err != nil {
		report(Result{false, err.Error(), extension})
	}
	ensureBuildDirectoryExists(extension)

	script.Start()

	logProcessors := sync.WaitGroup{}
	logProcessors.Add(2)

	nextSteps, _ := create.ReadTemplateFile(fmt.Sprintf(nextStepsTemplatePath, extension.Type))

	isInitialMessage := true

	go processLogs(stdout, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			if err := verifyAssets(extension); err != nil {
				report(Result{false, err.Error(), extension})
			} else {
				report(Result{true, message, extension})
				if isInitialMessage {
					fmt.Fprintf(os.Stdout, "%s\n",  string(nextSteps))
					isInitialMessage = false
				}
			}
		},
	})

	go processLogs(stderr, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			report(Result{false, message, extension})
		},
	})

	script.Wait()
	logProcessors.Wait()
}

type ResultHandler func(result Result)

func ensureBuildDirectoryExists(ext core.Extension) {
	if _, err := os.Stat(ext.BuildDir()); errors.Is(err, os.ErrNotExist) {
		os.MkdirAll(ext.BuildDir(), rwxr_xr_x)
	}
}

func configureScript(script *exec.Cmd, extension core.Extension) error {
	data, err := yaml.Marshal(extension)
	if err != nil {
		return fmt.Errorf("unable to serialize extension configuration information: %w", err)
	}
	script.Stdin = bytes.NewReader(data)
	return nil
}

const rwxr_xr_x = 0755
