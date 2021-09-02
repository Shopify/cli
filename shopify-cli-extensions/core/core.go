package core

import (
	"fmt"
	"io"

	"gopkg.in/yaml.v3"
)

func NewExtensionService(extensions []Extension, port int) *ExtensionService {
	for index, extension := range extensions {
		keys := make([]string, 0, len(extensions[index].Development.Entries))
		for key := range extensions[index].Development.Entries {
			keys = append(keys, key)
		}

		for entry := range keys {
			name := keys[entry]
			assetUrl := fmt.Sprintf("http://%s:%d/extensions/%s/assets/%s.js", "localhost", port, extension.UUID, name)
			extensions[index].Assets = append(extensions[index].Assets, Asset{Url: assetUrl, Name: name})
		}

		extensions[index].App = make(App)
	}

	service := ExtensionService{
		Version:    "0.1.0",
		Extensions: extensions,
		Port:       port,
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
	Port       int
}

type ExtensionService struct {
	Extensions []Extension
	Version    string
	Port       int
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

type Asset struct {
	Name string `json:"name" yaml:"name"`
	Url  string `json:"url" yaml:"url"`
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
