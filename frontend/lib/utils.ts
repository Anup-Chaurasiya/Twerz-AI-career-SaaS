import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EducationItem, ExperienceItem, ResumeInfo } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
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
  if (fallback) return fallback;
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export function getExperienceList(info?: ResumeInfo): ExperienceItem[] {
  return info?.past_experience ?? info?.experience ?? [];
}

export function getEducationList(info?: ResumeInfo): EducationItem[] {
  return info?.educations ?? info?.education ?? [];
}
