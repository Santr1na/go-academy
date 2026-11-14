//go:build unix

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// sandboxCred — если задан, код учеников (и компиляторы) запускается от имени
// этого непривилегированного пользователя. Нужен при публичном размещении:
// чужой код не сможет прочитать данные сервера и переменные его окружения.
var sandboxCred *syscall.Credential

// setupProcess запускает команду в отдельной группе процессов, чтобы при
// таймауте убить и её потомков (например, процессы компилятора).
func setupProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if sandboxCred != nil {
		cmd.SysProcAttr.Credential = sandboxCred
		chownWorkDir(cmd.Dir)
	}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = 2 * time.Second
}

// chownWorkDir передаёт пользователю песочницы временный каталог запуска
// (goacademy-*), в котором лежит рабочая папка команды.
func chownWorkDir(dir string) {
	if dir == "" {
		return
	}
	root := dir
	for root != "/" && root != "." && !strings.HasPrefix(filepath.Base(root), "goacademy-") {
		root = filepath.Dir(root)
	}
	if !strings.HasPrefix(filepath.Base(root), "goacademy-") {
		return
	}
	uid, gid := int(sandboxCred.Uid), int(sandboxCred.Gid)
	filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err == nil {
			os.Lchown(p, uid, gid)
		}
		return nil
	})
}
