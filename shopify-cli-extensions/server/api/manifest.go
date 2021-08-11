package api

func NewManifest() *Manifest {
	return &Manifest{
		Assets: make([]Asset, 0),
		User: User{
			Metafields: make([]Metafield, 0),
		},
		App: make(App),
	}
}

type Manifest struct {
	Type        string      `json:"type"`
	UUID        string      `json:"uuid"`
	Assets      []Asset     `json:"assets"`
	Development Development `json:"development"`
	User        User        `json:"user"`
	App         App         `json:"app"`
	Version     string      `json:"version"`
}

type Asset struct {
	Url `json:"url"`
}

type Development struct {
	Home     Url      `json:"home"`
	Manifest Url      `json:"manifest"`
	Status   Url      `json:"status"`
	Mobile   Url      `json:"mobile"`
	Resource Url      `json:"resource"`
	Renderer Renderer `json:"renderer"`
	Hidden   bool     `json:"hidden"`
	Focused  bool     `json:"focused"`
}

type Renderer struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type User struct {
	Metafields []Metafield `json:"metafields"`
}

type Metafield struct {
	Namespace string `json:"namespace"`
	Key       string `json:"key"`
}

type App map[string]interface{}

type Url struct {
	Url string `json:"url"`
}
