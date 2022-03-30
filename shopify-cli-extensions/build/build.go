package build

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
	"github.com/fsnotify/fsnotify"
	"gopkg.in/yaml.v3"

	"text/template"
)

const nextStepsTemplatePath = "templates/shared/%s/next-steps.txt"

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

func Watch(extension core.Extension, integrationCtx core.IntegrationContext, report ResultHandler) {
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

	templateBytes, _ := create.ReadTemplateFile(fmt.Sprintf(nextStepsTemplatePath, strings.ToLower(extension.Type)))

	go processLogs(stdout, logProcessingHandlers{
		onCompletion: func() { logProcessors.Done() },
		onMessage: func(message string) {
			if err := verifyAssets(extension); err != nil {
				report(Result{false, err.Error(), extension})
			} else {
				report(Result{true, message, extension})
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
			report(Result{false, message, extension})
		},
	})

	script.Wait()
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
	data, err := yaml.Marshal(extension)
	if err != nil {
		return fmt.Errorf("unable to serialize extension configuration information: %w", err)
	}
	script.Stdin = bytes.NewReader(data)
	return nil
}

const rwxr_xr_x = 0755

func getLocalization(extension *core.Extension) (*core.Localization, error) {
	path := filepath.Join(".", extension.Development.RootDir, "locales")
	emptyResponse := &core.Localization{
		DefaultLocale: "",
		Translations:  make(map[string]interface{}),
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// The extension does not have a locales directory.
		return emptyResponse, nil
	}

	fileNames, err := api.GetFileNames(path)
	if err != nil {
		return emptyResponse, err
	}
	translations := make(map[string]interface{})
	defaultLocale := ""
	defaultLocalesFound := []string{}

	for _, fileName := range fileNames {
		data, err := api.GetMapFromJsonFile(filepath.Join(path, fileName))
		if err != nil {
			return emptyResponse, err
		}

		locale := strings.Split(fileName, ".")[0]

		if api.IsDefaultLocale(fileName) {
			defaultLocalesFound = append(defaultLocalesFound, locale)
		}

		translations[locale] = data
	}

	if len(translations) == 0 {
		return emptyResponse, nil
	} else {

		if len(defaultLocalesFound) == 0 {
			log.Println("could not determine a default locale, please ensure you have a {locale}.default.json file")
		} else {
			if len(defaultLocalesFound) > 1 {
				log.Println("multiple default locales found, please ensure you only have a single {locale}.default.json file")
			}
			defaultLocale = defaultLocalesFound[0]
		}

		return &core.Localization{
			DefaultLocale: defaultLocale,
			Translations:  translations,
		}, nil
	}
}

func setLocalization(extension *core.Extension) error {
	localization, err := getLocalization(extension)

	if err != nil {
		log.Println(err)
		return err
	}
	extension.Localization = localization
	return nil
}

func WatchLocalization(ctx context.Context, extension core.Extension, report ResultHandler) {
	directory := filepath.Join(".", extension.Development.RootDir, "locales")
	if _, err := os.Stat(directory); os.IsNotExist(err) {
		// The extension does not have a locales directory.
		return
	}

	err := setLocalization(&extension)
	if err != nil {
		report(Result{false, err.Error(), extension})
	}
	report(Result{true, "successfully built localization", extension})

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	defer watcher.Close()

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				triggers := map[string]bool{
					fsnotify.Create.String(): true,
					fsnotify.Rename.String(): true,
					fsnotify.Write.String():  true,
				}

				if triggers[event.Op.String()] {
					err := setLocalization(&extension)
					if err != nil {
						report(Result{false, fmt.Sprintf("could not resolve localization, error: %s\n", err.Error()), extension})
					}
					report(Result{true, "successfully built localization", extension})
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Println("error:", err)
			}
		}
	}()

	err = watcher.Add(directory)
	log.Println("Watcher added for:", directory)
	if err != nil {
		log.Fatal(err)
	}
	<-ctx.Done()
}
