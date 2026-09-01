// ============================================================
// useCountdown — Custom hook for countdown timer logic
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerOptions {
  initialSeconds: number;
  onExpire: () => void;
  autoStart?: boolean;
}

export function useCountdown({ initialSeconds, onExpire, autoStart = true }: TimerOptions) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Start saat autoStart true dan initialSeconds > 0
  useEffect(() => {
    if (!autoStart) {
      // Saat ujian dikumpulkan atau timer dinonaktifkan, pastikan interval
      // yang aktif berhenti. Tanpa ini timer per-soal masih dapat berjalan
      // dan memanggil onExpire setelah submit berhasil.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRunning(false);
      deadlineRef.current = null;
      return;
    }

    const seconds = Math.max(0, Math.floor(initialSeconds));
    expiredRef.current = false;
    setRemaining(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
    // Memaksa efek interval membuat jadwal baru jika timer diaktifkan lagi
    // dengan status `running` yang masih true.
    setScheduleVersion(version => version + 1);
    if (seconds > 0) setRunning(true);
    else {
      setRunning(false);
      expiredRef.current = true;
      setTimeout(() => onExpireRef.current(), 0);
    }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    setRunning(false);
    deadlineRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback((seconds: number) => {
    expiredRef.current = false;
    const normalized = Math.max(0, Math.floor(seconds));
    setRemaining(normalized);
    deadlineRef.current = Date.now() + normalized * 1000;
    setRunning(normalized > 0);
    // `running` bisa sudah true saat murid berpindah soal. Versi jadwal
    // memastikan efek interval dibersihkan dan dimulai lagi untuk deadline
    // yang baru, bukan berhenti setelah interval sebelumnya dibersihkan.
    setScheduleVersion(version => version + 1);
    if (normalized === 0) {
      expiredRef.current = true;
      setTimeout(() => onExpireRef.current(), 0);
    }
  }, []);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(previous => previous === next ? previous : next);
      if (next === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setRunning(false);
        if (!expiredRef.current) {
          expiredRef.current = true;
          setTimeout(() => onExpireRef.current(), 0);
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, scheduleVersion]);

  const urgency = remaining <= 30 ? 'critical' : remaining <= 120 ? 'warning' : 'normal';

  return { remaining, running, stop, reset, urgency };
}
