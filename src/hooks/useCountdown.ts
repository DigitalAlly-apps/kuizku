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
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Start saat autoStart true dan initialSeconds > 0
  useEffect(() => {
    if (autoStart && initialSeconds > 0) {
      setRunning(true);
      setRemaining(initialSeconds);
      expiredRef.current = false;
    }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    setRunning(false);
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
    setRemaining(seconds);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running || remaining <= 0) return;

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          if (!expiredRef.current) {
            expiredRef.current = true;
            setTimeout(() => onExpireRef.current(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

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
