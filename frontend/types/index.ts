// USER & AUTH
export interface User {
  id: string;
  email: string;
  name: string;
  picture_url?: string;
  consent_accepted: boolean;
  is_super_admin: boolean;
  tenant_id?: string;
  tenant_name?: string;
}

export interface LoginResponse {
  url: string;
}

// PROFILE
export type ProfileStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface SkillItem {
  name: string;
  category: string;
}

export interface ResumeInfo {
  name?: string;
  email?: string;
  mobile_number?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills?: (SkillItem | string)[];
  past_experience?: ExperienceItem[];
  experience?: ExperienceItem[];
  educations?: EducationItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  certifications?: Array<{ name: string; credential_id?: string } | string>;
  links?: Array<{ name: string; url: string }>;
  [key: string]: any;
}

export interface ExperienceItem {
  company_name?: string;
  company?: string;
  role: string;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string;
  department?: string | null;
  location?: string | null;
  description?: string;
  achievements?: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string;
  grade?: string | null;
  gpa?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies?: string[];
  link?: string;
}

export interface Profile {
  id: number;
  status: ProfileStatus;
  is_active: boolean;
  resume_info?: ResumeInfo;
  created_at: string;
  updated_at: string;
}

export interface ProfileUploadResponse {
  profile_id: number;
  status: string;
  extracted_text?: string;
}

// JOB
export type JobStatus =
  | 'PENDING'
  | 'GENERATING_RESUME'
  | 'RESUME_GENERATED'
  | 'GENERATING_PDF'
  | 'READY'
  | 'FAILED';

export interface JobDescription {
  company: string;
  role: string;
  description: string;
  output_language?: 'english' | 'norwegian' | 'french' | 'german' | 'russian' | 'spanish' | 'italian';
}

export interface Job {
  id: number;
  profile_id: number;
  job_description: JobDescription;
  custom_resume_data?: ResumeInfo;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  candidate_name?: string;
}

export interface JobCreatePayload {
  profile_id: number;
  job_description: JobDescription;
}

// ROAST
export type RoastStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface RoastPoint {
  emoji: string;
  text: string;
}

export interface ATSCheckItem {
  label: string;
  passed: boolean;
  detail: string;
  category: 'parsing' | 'content' | 'formatting' | 'keywords';
}

export interface OCRVerification {
  text_matches_visual: boolean;
  issues_found: string[];
  summary: string;
}

export interface RoastResult {
  headline: string;
  roast_points: RoastPoint[];
  actual_feedback: string;
  score: number;
  verdict: string;
  ats_checklist: ATSCheckItem[];
  ocr_verification?: OCRVerification;
}

export interface Roast {
  id: number;
  share_id: string;
  status: RoastStatus;
  roast_data?: RoastResult;
  created_at: string;
  updated_at: string;
}

export interface RoastUploadResponse {
  roast_id: number;
  share_id: string;
  status: string;
  cached: boolean;
  extracted_text?: string;
}

// CREDITS & PAYMENTS
export interface CreditPack {
  id: number;
  name: string;
  credits: number;
  price_paise: number;
  is_active: boolean;
  sort_order: number;
}

export interface TimePassTier {
  id: number;
  name: string;
  duration_days: number;
  price_paise: number;
  is_active: boolean;
  sort_order: number;
}

export interface ActiveTimePassInfo {
  tier_name: string;
  expires_at: string;
}

export interface CreditBalance {
  balance: number;
  daily_free_remaining: number;
  daily_free_total: number;
  active_time_pass?: ActiveTimePassInfo;
  has_unlimited: boolean;
}

export interface CreditTransaction {
  id: number;
  amount: number;
  type: string;
  reference_id?: string;
  razorpay_order_id?: string;
  description?: string;
  created_at: string;
}

export interface CreateOrderResponse {
  order_id: string;
  amount_paise: number;
  currency: string;
  razorpay_key_id: string;
}

// CHAT
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatEvent {
  type: 'tool_call' | 'response' | 'error';
  name?: string;
  label?: string;
  response?: string;
  message?: string;
  resume_modified?: boolean;
  custom_resume_data?: ResumeInfo;
  resume_info?: ResumeInfo;
}

// ADMIN
export interface Tenant {
  id: string;
  name: string;
  user_count?: number;
  created_at: string;
}

export interface DomainRule {
  id: number;
  domain: string;
  tenant_id: string;
  tenant_name?: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  is_super_admin: boolean;
  tenant_id?: string;
  tenant_name?: string;
  balance: number;
  daily_free_remaining: number;
  job_count: number;
  active_time_pass?: { tier_name: string; expires_at: string };
  created_at: string;
}

export interface PromoCode {
  id: number;
  code: string;
  type: 'CREDITS' | 'TIME_PASS';
  value: number;
  max_redemptions: number;
  current_redemptions: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface AdminOverview {
  total_users: number;
  total_jobs: number;
  completed_jobs: number;
  total_purchase_txns: number;
  active_time_passes: number;
  consumed_today: number;
  total_profiles: number;
  total_roasts: number;
  new_users_today: number;
  new_users_7d: number;
  job_status_breakdown: Record<string, number>;
  roast_status_breakdown: Record<string, number>;
  funnel: { users: number; profiles: number; jobs: number; ready_jobs: number };
  llm_summary: {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    avg_response_time_ms: number;
    success_rate_pct: number;
    total_estimated_cost_usd: number;
    by_model: Array<{
      model_name: string;
      request_count: number;
      input_tokens: number;
      output_tokens: number;
      cached_tokens: number;
      avg_response_time_ms: number;
      estimated_cost_usd: number;
    }>;
  };
  trends: { labels: string[]; users: number[]; profiles: number[]; jobs: number[]; roasts: number[] };
  recent_activity: Array<{
    id: number;
    user_email: string;
    amount: number;
    type: string;
    description?: string;
    created_at: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface APIError {
  detail: string;
  status?: number;
}
