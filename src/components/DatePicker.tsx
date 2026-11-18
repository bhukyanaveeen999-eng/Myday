import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(date.getTime()) ? null : date;
}

function formatReadableDate(value: string): string {
  const date = parseYMD(value);
  if (!date) return '';
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  compact = false,
  placeholder = 'Select date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = toYMD(today);

  const selectedDate = parseYMD(value);
  const [viewYear, setViewYear] = useState<number>(
    selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    selectedDate ? selectedDate.getMonth() : today.getMonth()
  );

  // Keep calendar view synced when external value changes
  useEffect(() => {
    const parsed = parseYMD(value);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  // Close popover on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectOffsetDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    onChange(toYMD(target));
    setIsOpen(false);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toYMD(tomorrowDate);

  const nextWeekDate = new Date();
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekStr = toYMD(nextWeekDate);

  const readable = formatReadableDate(value);

  return (
    <div ref={containerRef} className={compact ? 'relative inline-block' : 'relative space-y-2'}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            compact ? 'min-w-[150px]' : 'w-full'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
            <span className={readable ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {readable || placeholder}
            </span>
          </span>
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear date"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Presets (Full mode) */}
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => selectOffsetDays(0)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              value === todayStr
                ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => selectOffsetDays(1)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              value === tomorrowStr
                ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => selectOffsetDays(7)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              value === nextWeekStr
                ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Next Week
          </button>
        </div>
      )}

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          {/* Quick Shortcuts inside popover */}
          <div className="flex items-center justify-between gap-1 pb-2.5 mb-2.5 border-b border-gray-100">
            <button
              type="button"
              onClick={() => selectOffsetDays(0)}
              className="flex-1 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => selectOffsetDays(1)}
              className="flex-1 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => selectOffsetDays(7)}
              className="flex-1 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              +7 Days
            </button>
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between gap-1 mb-2.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Previous month"
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              <select
                aria-label="Month"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-[11px] font-medium text-gray-400 py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <span key={`empty-${idx}`} />;
              }
              const cellStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = cellStr === value;
              const isToday = cellStr === todayStr;

              return (
                <button
                  key={cellStr}
                  type="button"
                  onClick={() => {
                    onChange(cellStr);
                    setIsOpen(false);
                  }}
                  className={`h-8 w-8 mx-auto rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : isToday
                      ? 'border border-blue-500 text-blue-700 hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

