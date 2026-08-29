import { useEffect, useRef, useState } from 'react';
import type { FocusEventHandler, InputHTMLAttributes } from 'react';

type NativeNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'>;

interface NumericInputProps extends NativeNumberInputProps {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
  fallbackValue?: number;
  integer?: boolean;
}

const toDraft = (value?: number | null) => (
  typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
);

/**
 * Controlled numeric input with a local text draft.
 *
 * A numeric value must be allowed to become temporarily empty while the user
 * replaces it. The normalized number is committed on blur, so deleting `0`
 * does not immediately force it back into the field.
 */
export default function NumericInput({
  value,
  onValueChange,
  fallbackValue,
  integer = false,
  min,
  max,
  step,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [draft, setDraft] = useState(() => toDraft(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(toDraft(value));
  }, [value]);

  const handleFocus: FocusEventHandler<HTMLInputElement> = event => {
    focusedRef.current = true;
    onFocus?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = event => {
    focusedRef.current = false;

    let normalized = draft === '' ? fallbackValue : Number(draft);
    if (typeof normalized !== 'number' || !Number.isFinite(normalized)) {
      normalized = fallbackValue;
    }

    if (typeof normalized === 'number') {
      if (integer) normalized = Math.trunc(normalized);
      if (typeof min === 'number') normalized = Math.max(min, normalized);
      if (typeof max === 'number') normalized = Math.min(max, normalized);
      setDraft(String(normalized));
      onValueChange(normalized);
    } else {
      setDraft('');
      onValueChange(undefined);
    }

    onBlur?.(event);
  };

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={step ?? (integer ? 1 : undefined)}
      value={draft}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={event => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw === '') {
          onValueChange(undefined);
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
    />
  );
}
