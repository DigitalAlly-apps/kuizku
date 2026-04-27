// ============================================================
// useExamTimer — Custom hook for countdown timer logic
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerOptions {
  initialSeconds: number;
  onExpire: () => void;
  autoStart?: boolean;
}

export function useCountdown({ initialSeconds, onExpire, autoStart = true }: TimerOptions) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback((seconds: number) => {
    expiredRef.current = false;
    setRemaining(seconds);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (!expiredRef.current) {
            expiredRef.current = true;
            setTimeout(onExpire, 0); // call outside render
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, onExpire]);

  const urgency = remaining <= 30 ? 'critical' : remaining <= 120 ? 'warning' : 'normal';

  return { remaining, running, stop, reset, urgency };
}
