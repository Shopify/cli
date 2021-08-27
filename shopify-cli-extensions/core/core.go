package core

import (
	"fmt"
	"io"

	"gopkg.in/yaml.v3"
)

func NewExtensionService(extensions []Extension) *ExtensionService {
	for index, extension := range extensions {
		extensions[index].Assets = []Asset{
			AssetFromUrl(
				fmt.Sprintf("http://%s:%d/extensions/%s/assets/%s", "localhost", 8000, extension.UUID, "index.js"),
			),
		}
		extensions[index].App = make(App)
	}

	service := ExtensionService{
		Version:    "0.1.0",
		Extensions: extensions,
	}

	return &service
}

func LoadConfig(r io.Reader) (config *Config, err error) {
	config = &Config{}
	decoder := yaml.NewDecoder(r)
	err = decoder.Decode(config)
	return
}

type Config struct {
	Extensions []Extension `yaml:"extensions"`
}

type ExtensionService struct {
	Extensions []Extension
	Version    string
}

type Extension struct {
	Type        string      `json:"type" yaml:"type"`
	UUID        string      `json:"uuid" yaml:"uuid"`
	Assets      []Asset     `json:"assets" yaml:"-"`
	Development Development `json:"development" yaml:"development"`
	User        User        `json:"user" yaml:"user"`
	App         App         `json:"app" yaml:"-"`
	Version     string      `json:"version" yaml:"version"`
}

func AssetFromUrl(url string) Asset {
	return Asset{Url{Url: url}}
}

type Asset struct {
	Url `json:"url"`
}

type Development struct {
	Home     Url               `json:"home"`
	Manifest Url               `json:"manifest"`
	Status   Url               `json:"status"`
	Mobile   Url               `json:"mobile"`
	Resource Url               `json:"resource"`
	Renderer Renderer          `json:"renderer"`
	Hidden   bool              `json:"hidden"`
	Focused  bool              `json:"focused"`
	BuildDir string            `json:"-" yaml:"build_dir"`
	RootDir  string            `json:"-" yaml:"root_dir"`
	Template string            `json:"-"`
	Entries  map[string]string `json:"-"`
}

type Renderer struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type User struct {
	Metafields []Metafield `json:"metafields" yaml:"metafields"`
}

type Metafield struct {
	Namespace string `json:"namespace" yaml:"namespace"`
	Key       string `json:"key" yaml:"key"`
}

type App map[string]interface{}

type Url struct {
	Url string `json:"url" yaml:"url"`
}
