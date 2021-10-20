package build

import (
	"errors"
	"os"
	"sync"

	"github.com/Shopify/shopify-cli-extensions/core"
)

func Build(extension core.Extension, report ResultHandler) {
	script, err := script(extension.BuildDir(), "build")
	if err != nil {
		report(Result{false, err.Error(), extension})
		return
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

	ensureBuildDirectoryExists(extension)

	script.Start()

	logProcessors := sync.WaitGroup{}
	logProcessors.Add(2)

	go processLogs(stdout, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			if err := verifyAssets(extension); err != nil {
				report(Result{false, err.Error(), extension})
			} else {
				report(Result{true, message, extension})
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

const rwxr_xr_x = 0755
