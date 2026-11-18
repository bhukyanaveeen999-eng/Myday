import React from 'react';
import { Clock, X } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm" (24-hour format) or ""
  onChange: (value: string) => void;
  compact?: boolean;
}

interface ParsedTime {
  hour12: string; // "1".."12" or ""
  minute: string; // "00".."59" or ""
  period: 'AM' | 'PM';
}

const PRESETS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '9:00 PM', value: '21:00' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parse24h(value: string): ParsedTime {
  if (!value || !value.includes(':')) {
    return { hour12: '', minute: '', period: 'AM' };
  }
  const [hStr, mStr] = value.split(':');
  const h24 = parseInt(hStr, 10);
  const min = parseInt(mStr, 10);
  if (isNaN(h24) || isNaN(min)) {
    return { hour12: '', minute: '', period: 'AM' };
  }

  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  return {
    hour12: String(h12),
    minute: String(min).padStart(2, '0'),
    period,
  };
}

function to24h(hour12: string, minute: string, period: 'AM' | 'PM'): string {
  if (!hour12) return '';
  let h = parseInt(hour12, 10);
  if (isNaN(h)) return '';
  if (period === 'AM') {
    h = h === 12 ? 0 : h;
  } else {
    h = h === 12 ? 12 : h + 12;
  }
  const m = minute || '00';
  return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, compact = false }) => {
  const { hour12, minute, period } = parse24h(value);

  const handleHourChange = (newHour: string) => {
    if (!newHour) {
      onChange('');
      return;
    }
    onChange(to24h(newHour, minute || '00', period));
  };

  const handleMinuteChange = (newMinute: string) => {
    const effectiveHour = hour12 || '9';
    onChange(to24h(effectiveHour, newMinute || '00', period));
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    const effectiveHour = hour12 || '9';
    const effectiveMin = minute || '00';
    onChange(to24h(effectiveHour, effectiveMin, newPeriod));
  };

  const formattedDisplay = hour12 ? `${hour12}:${minute || '00'} ${period}` : '';

  return (
    <div className={compact ? 'flex items-center gap-1.5' : 'space-y-2.5'}>
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        {/* Hour Select */}
        <select
          aria-label="Hour"
          value={hour12}
          onChange={(e) => handleHourChange(e.target.value)}
          className="px-2.5 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Hr</option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="text-gray-500 font-semibold">:</span>

        {/* Minute Select */}
        <select
          aria-label="Minute"
          value={minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className="px-2.5 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Min</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* AM / PM Toggle */}
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => handlePeriodChange('AM')}
            className={`px-2.5 py-2 text-xs font-semibold transition-colors ${
              hour12 && period === 'AM'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange('PM')}
            className={`px-2.5 py-2 text-xs font-semibold border-l border-gray-300 transition-colors ${
              hour12 && period === 'PM'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            PM
          </button>
        </div>

        {/* Clear Time Button */}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear time"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Presets & Human-Readable Preview (Full mode only) */}
      {!compact && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChange(preset.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  value === preset.value
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            {formattedDisplay ? (
              <span>
                Selected time: <strong className="text-gray-800">{formattedDisplay}</strong>
              </span>
            ) : (
              <span>No time set (uses 9:00 AM if a date is chosen)</span>
            )}
          </p>
        </>
      )}
    </div>
  );
};

