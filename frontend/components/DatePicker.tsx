'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isValid, parseISO } from 'date-fns';
import { toDateInputValue } from '@/lib/utils';
import 'react-day-picker/style.css';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function parseValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className = 'input-field',
  disabled = false,
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());
  const display = selected ? format(selected, 'MMMM d, yyyy') : '';

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="app-date-picker">
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (selected) setMonth(selected);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={{ color: display ? 'var(--text-primary)' : 'var(--text-dim)' }}>
          {display || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="app-date-picker-popover animate-fade-in" role="dialog" aria-label="Choose date">
          <DayPicker
            mode="single"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              if (date) {
                onChange(toDateInputValue(date));
                setOpen(false);
              }
            }}
            showOutsideDays
            fixedWeeks
          />
          <div className="app-date-picker-footer">
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => {
                const today = new Date();
                onChange(toDateInputValue(today));
                setMonth(today);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
