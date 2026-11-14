//go:build unix

package main

import (
	"os/exec"
	"syscall"
	"time"
)

// setupProcess запускает команду в отдельной группе процессов, чтобы при
// таймауте убить и её потомков (например, процессы компилятора).
func setupProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = 2 * time.Second
}
