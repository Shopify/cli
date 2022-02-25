package create

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
	"gopkg.in/yaml.v3"
)

type dummyRunner struct{}

func (r dummyRunner) Run() error { return nil }
func makeDummyRunner(path, executable string, args ...string) Runner {
	return dummyRunner{}
}

func TestMergeTemplatesYAML(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestMergeTemplatesYML"
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

	file, err := os.ReadFile(fmt.Sprintf("%s/extension.config.yml", rootDir))

	if err != nil {
		t.Error(err)
	}

	config := core.Extension{}
	err = yaml.Unmarshal(file, &config)

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

func TestMergeTemplatesJSON(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestMergeTemplatesJSON"
	extension := core.Extension{
		Type: "integration_test",
		Development: core.Development{
			Template: "typescript-react",
			RootDir:  rootDir,
			Renderer: core.Renderer{Name: "@shopify/admin-ui-extension"},
		},
	}

	err := NewExtensionProject(extension)

	if err != nil {
		t.Fatal(err)
	}

	file, err := os.ReadFile(fmt.Sprintf("%s/package.json", rootDir))

	if err != nil {
		t.Error(err)
	}

	config := packageJSON{}
	err = json.Unmarshal(file, &config)

	if err != nil {
		t.Error(err)
	}

	if config.Name != extension.Type {
		t.Errorf("expect \"name\" to match extension type but received %v", config.Name)
	}

	if config.License != "MIT" {
		t.Errorf("expect \"licence\" to match template but received %v", config.License)
	}

	if config.Dependencies["react"] != "^17.0.0" {
		t.Errorf("expect \"react\" dependency to match template config but received %v", config.Dependencies["react"])
	}

	if config.Dependencies["@apollo/client"] != "^3.4.8" {
		t.Errorf("expect \"@apollo/client\" dependency to match template config but received %v", config.Dependencies["@apollo/client"])
	}

	if config.Dependencies["@shopify/admin-ui-extension-react"] != "latest" {
		t.Errorf("expect \"@shopify/admin-ui-extension-react\" dependency to match template config but received %v", config.Dependencies["@shopify/admin-ui-extension-react"])
	}

	if config.Dependencies["graphql"] != "^15.5.1" {
		t.Errorf("expect \"graphql\" dependency to match template config but received %v", config.Dependencies["graphql"])
	}

	if config.Dependencies["graphql-tag"] != "^2.12.4" {
		t.Errorf("expect \"graphql-tag\" dependency to match template config but received %v", config.Dependencies["graphql-tag"])
	}

	if config.DevDependencies["@shopify/shopify-cli-extensions"] != "latest" {
		t.Errorf("expect \"@shopify/shopify-cli-extensions\" dependency to match template config but received %v", config.Dependencies["@shopify/shopify-cli-extensions"])
	}

	if config.DevDependencies["typescript"] != "^4.1.0" {
		t.Errorf("expect \"typescript\" dependency to match template config but received %v", config.Dependencies["typescript"])
	}

	t.Cleanup(func() {
		os.RemoveAll(rootDir)
	})
}

func TestShopifyCliYAML(t *testing.T) {
	Command = makeDummyRunner
	LookPath = func(file string) (string, error) {
		return file, nil
	}
	rootDir := "tmp/TestShopifyCliYAML"
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

	file, err := os.ReadFile(fmt.Sprintf("%s/.shopify-cli.yml", rootDir))

	if err != nil {
		t.Error(err)
	}

	config := shopifyCLIYML{}
	err = yaml.Unmarshal(file, &config)

	if err != nil {
		t.Fatal(err)
	}

	if config.ExtensionType != "INTEGRATION_TEST" {
		t.Errorf("expect \"ExtensionType\" to match extension type but received %v", config.ExtensionType)
	}

	if config.OrganizationId != "0" {
		t.Errorf("expect \"OrganizationId\" to match template but received %v", config.OrganizationId)
	}

	if config.ProjectType != ":extension" {
		t.Errorf("expect \"OrganizationId\" to match template but received %v", config.ProjectType)
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
