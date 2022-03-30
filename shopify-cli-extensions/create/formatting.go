package create

import (
	"bytes"
	"encoding/json"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/core/fsutils"
	"gopkg.in/yaml.v3"
)

func formatContent(targetPath string, content []byte) ([]byte, error) {
	if strings.HasSuffix(targetPath, fsutils.JSON) {
		return formatJSON(content)
	}

	if strings.HasSuffix(targetPath, fsutils.YAML) {
		return formatYaml(content, targetPath)
	}
	return content, nil
}

func formatJSON(input []byte) ([]byte, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(input, &result); err != nil {
		return nil, err
	}

	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(result); err != nil {
		return nil, err
	}

	return output.Bytes(), nil
}

func formatYaml(unformattedContent []byte, targetPath string) (content []byte, err error) {
	var b bytes.Buffer
	var config interface{}

	if strings.HasSuffix(targetPath, cliConfigYamlFile) {
		config = shopifyCLIYML{}
	} else if strings.HasSuffix(targetPath, configYamlFile) {
		config = core.Extension{}
	} else {
		return
	}

	err = yaml.Unmarshal(unformattedContent, &config)

	if err != nil {
		return
	}

	yamlEncoder := yaml.NewEncoder(&b)
	yamlEncoder.SetIndent(2)
	yamlEncoder.Encode(&config)

	content = []byte("---\n")
	content = append(content, b.Bytes()...)
	return
}

type shopifyCLIYML struct {
	ProjectType    string `yaml:"project_type"`
	OrganizationId string `yaml:"organization_id"`
	ExtensionType  string `yaml:"EXTENSION_TYPE"`
}
