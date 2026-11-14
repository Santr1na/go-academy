//go:build linux

package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// enableSandbox включает запуск кода учеников от имени uid и ограничения,
// которые наследуют дочерние процессы: число процессов (защита от fork-бомбы)
// и размер одного файла (защита от заполнения диска).
func enableSandbox(uid int) error {
	if os.Geteuid() != 0 {
		return fmt.Errorf("для -sandbox-uid сервер должен работать от root (сейчас uid %d)", os.Geteuid())
	}
	cred := &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid), NoSetGroups: true}
	// Проверяем, что смена пользователя разрешена (на некоторых хостингах
	// у контейнера отобраны нужные права).
	probe := exec.Command("/bin/sh", "-c", "exit 0")
	probe.SysProcAttr = &syscall.SysProcAttr{Credential: cred}
	if err := probe.Run(); err != nil {
		return fmt.Errorf("не удалось запустить процесс от имени uid %d: %w", uid, err)
	}
	sandboxCred = cred
	const rlimitNproc = 6
	if err := syscall.Setrlimit(rlimitNproc, &syscall.Rlimit{Cur: 512, Max: 512}); err != nil {
		return fmt.Errorf("ограничение числа процессов: %w", err)
	}
	if err := syscall.Setrlimit(syscall.RLIMIT_FSIZE, &syscall.Rlimit{Cur: 200 << 20, Max: 200 << 20}); err != nil {
		return fmt.Errorf("ограничение размера файла: %w", err)
	}
	return nil
}
