package build

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
)

type LookPath func(file string) (string, error)

func FindPackageManager(lp LookPath, workingDir string) *PackageManager {
	_, err := lp("yarn")
	if err != nil {
		return npm(workingDir)
	}
	return yarn(workingDir)
}

type FormatArgs func(script string, args ...string) []string

type PackageManager struct {
	name       string
	formatArgs FormatArgs
	workingDir string
	stdout     io.Writer
	stderr     io.Writer
}

func npm(workingDir string) *PackageManager {
	return &PackageManager{
		name: "npm",
		formatArgs: func(script string, args ...string) []string {
			args = append([]string{"run", script, "--"}, args...)
			return args
		},
		workingDir: workingDir,
		stdout:     os.Stdout,
		stderr:     os.Stderr,
	}
}

func yarn(workingDir string) *PackageManager {
	return &PackageManager{
		name: "yarn",
		formatArgs: func(script string, args ...string) []string {
			return append([]string{script}, args...)
		},
		workingDir: workingDir,
		stdout:     os.Stdout,
		stderr:     os.Stderr,
	}
}

func (pm *PackageManager) RunScript(ctx context.Context, script string, args ...string) error {
	cmd := exec.CommandContext(ctx, pm.name, pm.formatArgs(script, args...)...)
	cmd.Dir = pm.workingDir
	cmd.Stdout = pm.stdout
	cmd.Stderr = pm.stderr

	if _, err := os.Stat(pm.workingDir); os.IsNotExist(err) {
		return errors.New(err.Error())
	}

	return cmd.Run()
}
