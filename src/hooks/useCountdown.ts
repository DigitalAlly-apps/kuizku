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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Start saat autoStart true dan initialSeconds > 0
  useEffect(() => {
    if (!autoStart) return;
    const seconds = Math.max(0, Math.floor(initialSeconds));
    expiredRef.current = false;
    setRemaining(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    expiredRef.current = false;
    const normalized = Math.max(0, Math.floor(seconds));
    setRemaining(normalized);
    deadlineRef.current = Date.now() + normalized * 1000;
    setRunning(normalized > 0);
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
  }, [running]);

  const urgency = remaining <= 30 ? 'critical' : remaining <= 120 ? 'warning' : 'normal';

  return { remaining, running, stop, reset, urgency };
}
