import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EducationItem, ExperienceItem, Profile, ResumeInfo } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable profile label — never "Profile #N". */
export function getProfileDisplayName(profile: Pick<Profile, 'resume_info' | 'source_filename' | 'created_at' | 'status'>): string {
  const name = profile.resume_info?.name?.trim();
  if (name) return name;
  const filename = profile.source_filename?.trim();
  if (filename) return filename.replace(/\.pdf$/i, '');
  if (profile.status === 'PROCESSING' || profile.status === 'PENDING') return 'Processing resume…';
  if (profile.status === 'FAILED') return 'Failed resume upload';
  if (profile.created_at) {
    const d = new Date(profile.created_at);
    if (!Number.isNaN(d.getTime())) {
      return `Resume uploaded ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }
  return 'Untitled resume';
}

export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Label + hint for resume generation cost (daily free bucket is consumed first). */
export function formatResumeGenerationCost(
  cost: number,
  dailyFreeRemaining: number,
  hasUnlimited?: boolean,
): { label: string; hint: string } {
  if (hasUnlimited) {
    return { label: 'Unlimited', hint: 'Active pass — no credit charge.' };
  }
  const fromFree = Math.min(Math.max(0, dailyFreeRemaining), cost);
  const fromBalance = cost - fromFree;
  const label = `${cost} credits`;
  let hint: string;
  if (fromFree === 0) {
    hint = `${cost} credits from your purchased balance.`;
  } else if (fromBalance === 0) {
    hint = `${cost} credits total — covered by your ${fromFree} free credit${fromFree === 1 ? '' : 's'} today (balance unchanged).`;
  } else {
    hint = `${cost} credits total — ${fromFree} from free today, ${fromBalance} from your balance.`;
  }
  return { label, hint };
}

/** Format resume dates as "January 2025" (or with day for follow-ups). */
export function formatMonthYear(
  value: string | null | undefined,
  opts?: { includeDay?: boolean }
): string {
  if (!value) return '';
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'present' || lower === 'current') return 'Present';

  const iso = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = iso[3] ? Number(iso[3]) : 1;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      if (opts?.includeDay && iso[3]) {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }

  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'READY': return 'badge-ready';
    case 'PROCESSING': case 'GENERATING_RESUME': case 'GENERATING_PDF': case 'RESUME_GENERATED': return 'badge-processing';
    case 'PENDING': return 'badge-pending';
    case 'FAILED': return 'badge-failed';
    default: return 'badge-pending';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'GENERATING_RESUME': return 'Gen Resume';
    case 'GENERATING_PDF': return 'Gen PDF';
    case 'RESUME_GENERATED': return 'Resume Done';
    default: return status;
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/** Group skills by category (API returns { name, category } objects). */
export function groupSkillsByCategory(
  skills: Array<{ name: string; category?: string } | string> | undefined
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const skill of skills ?? []) {
    if (typeof skill === 'string') {
      (groups.Other ??= []).push(skill);
    } else {
      const cat = skill.category || 'Other';
      (groups[cat] ??= []).push(skill.name);
    }
  }
  return groups;
}

export function formatDateRange(
  start?: string | null,
  end?: string | null,
  fallback?: string
): string {
  if (fallback) return formatMonthYear(fallback) || fallback;
  const s = start ? formatMonthYear(start) : '';
  const e = end ? formatMonthYear(end) : '';
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

export function getExperienceList(info?: ResumeInfo): ExperienceItem[] {
  return info?.past_experience ?? info?.experience ?? [];
}

export function getEducationList(info?: ResumeInfo): EducationItem[] {
  return info?.educations ?? info?.education ?? [];
}
