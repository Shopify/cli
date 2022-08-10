package create

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/BurntSushi/toml"
	"github.com/Shopify/shopify-cli-extensions/core"
)

type dummyRunner struct{}

func (r dummyRunner) Run() error                      { return nil }
func (r dummyRunner) CombinedOutput() ([]byte, error) { return []byte{}, nil }

func makeDummyRunner(path, executable string, args ...string) Runner {
	return dummyRunner{}
}

func TestMergeTemplatesTOML(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestMergeTemplatesYML"
	extension := core.Extension{
		Type:  "integration_test",
		Title: "Integration Test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  rootDir,
			Renderer: core.Renderer{Name: "@shopify/checkout_ui_extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	file, err := os.ReadFile(fmt.Sprintf("%s/shopify.ui.extension.toml", rootDir))

	if err != nil {
		t.Error(err)
	}

	config := core.Extension{}
	err = toml.Unmarshal(file, &config)

	if err != nil {
		t.Error(err)
	}

	if len(config.ExtensionPoints) != 1 {
		t.Errorf("expect extension points to have length of 1 but received %v", len(config.ExtensionPoints))
	}

	if config.ExtensionPoints[0] != "Playground" {
		t.Errorf("expect extension point to be \"Playground\" but received %v", config.ExtensionPoints[0])
	}

	if len(config.Metafields) != 1 {
		t.Errorf("expect metafields to have length of 1 but received %v", len(config.Metafields))
	}

	if config.Metafields[0].Namespace != "my-namespace" {
		t.Errorf("expect metafields[0] namespace to be \"my-namespace\" but received %v", config.Metafields[0].Namespace)
	}

	if config.Metafields[0].Key != "my-key" {
		t.Errorf("expect metafields[0] key to be \"my-key\" but received %v", config.Metafields[0].Key)
	}

	if config.Development.Build.Env["CUSTOM_VAR"] != "bar" {
		t.Errorf("expect build environment config to be set to \"bar\" but received %v", config.Development.Build.Env["CUSTOM_VAR"])
	}
	if config.Development.Develop.Env["CUSTOM_VAR"] != "foo" {
		t.Errorf("expect develop environment config to be set to \"foo\" but received %v", config.Development.Develop.Env["CUSTOM_VAR"])
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}

func TestCreateMainIndex(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestCreateMainIndex"
	extension := core.Extension{
		Type: "integration_test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  "tmp/TestCreateMainIndex",
			Renderer: core.Renderer{Name: "@shopify/post-purchase-ui-extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	file, err := os.ReadFile(fmt.Sprintf("%s/src/index.tsx", rootDir))

	if err != nil {
		t.Errorf("expect main index file to exist but got error %v", err)
	}

	strContent := string(file)

	if !strings.Contains(strContent, "@shopify/post-purchase-ui-extension-react") {
		t.Errorf("main index file does not import \"@shopify/post-purchase-ui-extension-react\" as expected")
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}

func TestCreateAdditionalSourceFiles(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestCreateAdditionalSourceFiles"
	extension := core.Extension{
		Type: "integration_test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  rootDir,
			Renderer: core.Renderer{Name: "@shopify/post-purchase-ui-extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	_, err = os.ReadFile(fmt.Sprintf("%s/src/Country.graphql", rootDir))

	if err != nil {
		t.Errorf("expect additional source files from template to be present but got error %v", err)
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}

func TestInstallDependencies(t *testing.T) {
	runnerWasCalled := false
	Command = func(path, executable string, args ...string) Runner {
		runnerWasCalled = true
		return dummyRunner{}
	}
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestInstallDependencies"
	extension := core.Extension{
		Type: "integration_test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  rootDir,
			Renderer: core.Renderer{Name: "@shopify/post-purchase-ui-extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	if runnerWasCalled == false {
		t.Fatal("Expected runner to be called")
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}

func TestCreateLocaleFiles(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestCreateLocalesFiles"
	extension := core.Extension{
		Type: "integration_test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  rootDir,
			Renderer: core.Renderer{Name: "@shopify/checkout_ui_extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	files, err := os.ReadDir(fmt.Sprintf("%s/locales", rootDir))
	if err != nil {
		t.Error("expect a \"/locales\" directory to exist")
	}

	if len(files) == 0 {
		t.Error("expect the locales directory to have locale files")
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}
