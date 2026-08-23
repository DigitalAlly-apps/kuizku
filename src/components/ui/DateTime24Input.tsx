interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

/** A locale-independent date/time control. Time is always shown as 00–23:00–59. */
export default function DateTime24Input({ id, value, onChange, disabled }: Props) {
  const [date = '', rawTime = '00:00'] = value.split('T');
  const [hour = '00', minute = '00'] = rawTime.split(':');
  const update = (nextDate: string, nextHour: string, nextMinute: string) => {
    onChange(nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : '');
  };

  return (
    <div className="datetime-24-input">
      <input id={id} type="date" className="form-input" value={date} disabled={disabled}
        onChange={event => update(event.target.value, hour, minute)} />
      <div className="datetime-24-time" aria-label="Waktu 24 jam">
        <select className="form-select" value={hour} disabled={disabled || !date} aria-label="Jam (00 sampai 23)"
          onChange={event => update(date, event.target.value, minute)}>
          {hours.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <span aria-hidden="true">:</span>
        <select className="form-select" value={minute} disabled={disabled || !date} aria-label="Menit"
          onChange={event => update(date, hour, event.target.value)}>
          {minutes.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </div>
  );
}
