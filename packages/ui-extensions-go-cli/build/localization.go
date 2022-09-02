package build

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/logging"
	"github.com/fsnotify/fsnotify"
)

func getFileNames(folderPath string) ([]string, error) {
	files := []string{}
	items, err := os.ReadDir(folderPath)
	if err != nil {
		return files, err
	}
	for _, item := range items {
		if !item.IsDir() {
			files = append(files, item.Name())
		}
	}
	return files, nil
}

func getMapFromJsonFile(filePath string) (map[string]interface{}, error) {
	var result map[string]interface{}

	byteValue, err := os.ReadFile(filePath)

	if err != nil {
		return result, err
	}

	err = json.Unmarshal([]byte(byteValue), &result)

	if err != nil {
		return result, err
	}

	return result, nil
}

func isDefaultLocale(fileName string) bool {
	return strings.HasSuffix(fileName, ".default.json")
}

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

	fileNames, err := getFileNames(path)
	if err != nil {
		return emptyResponse, err
	}
	translations := make(map[string]interface{})
	defaultLocale := ""
	defaultLocalesFound := []string{}

	for _, fileName := range fileNames {
		data, err := getMapFromJsonFile(filepath.Join(path, fileName))
		if err != nil {
			return emptyResponse, err
		}

		locale := strings.Split(fileName, ".")[0]

		if isDefaultLocale(fileName) {
			defaultLocalesFound = append(defaultLocalesFound, locale)
		}

		translations[locale] = data
	}

	if len(translations) == 0 {
		return emptyResponse, nil
	} else {

		if len(defaultLocalesFound) == 0 {
			log.Print("could not determine a default locale, please ensure you have a {locale}.default.json file")
		} else {
			if len(defaultLocalesFound) > 1 {
				log.Print("multiple default locales found, please ensure you only have a single {locale}.default.json file")
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
		return err
	}
	extension.Localization = localization
	extension.Localization.LastUpdated = time.Now().Unix()
	return nil
}

func reportAndUpdateLocalizationStatus(result Result, report ResultHandler) {
	if result.Success {
		result.Extension.Localization.LastUpdated = time.Now().Unix()
		result.Extension.Development.LocalizationStatus = "success"
	} else {
		result.Extension.Development.LocalizationStatus = "error"
	}

	report(result)
}

func WatchLocalization(ctx context.Context, extension core.Extension, report ResultHandler, logBuilder logging.LogEntryBuilder) {
	logWatchLocalizationBuilder := logBuilder.AddWorkflowSteps(logging.Build, logging.Watch, logging.Localization)
	logWatchLocalizationBuilder.SetExtensionId(extension.UUID)
	logWatchLocalizationBuilder.SetExtensionName(extension.Title)

	directory := filepath.Join(".", extension.Development.RootDir, "locales")
	if _, err := os.Stat(directory); os.IsNotExist(err) {
		// The extension does not have a locales directory.
		return
	}

	err := setLocalization(&extension)
	if err != nil {
		reportAndUpdateLocalizationStatus(Result{false, err.Error(), extension}, report)
	}
	reportAndUpdateLocalizationStatus(Result{true, "successfully built localization", extension}, report)

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
						reportAndUpdateLocalizationStatus(Result{
							false,
							fmt.Sprintf("could not resolve localization, error: %s", err.Error()),
							extension,
						}, report)
					}
					reportAndUpdateLocalizationStatus(Result{true, "successfully built localization", extension}, report)
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Print("error:", err)
			}
		}
	}()

	err = watcher.Add(directory)
	logWatchLocalizationBuilder.SetStatus(logging.InProgress)
	logWatchLocalizationBuilder.Build(fmt.Sprintf("Watcher added for %s", directory)).WriteLog(os.Stdout)

	if err != nil {
		logWatchLocalizationBuilder.SetStatus(logging.Failure)
		logWatchLocalizationBuilder.Build(fmt.Sprintf("Error adding watcher to %s: %s", directory, err.Error())).WriteLog(os.Stdout)
		os.Exit(1)
	}
	<-ctx.Done()
}
