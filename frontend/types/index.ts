// USER & AUTH
export interface User {
  id: string;
  email: string;
  name: string;
  picture_url?: string;
  consent_accepted: boolean;
  onboarding_completed?: boolean;
  is_new_user?: boolean;
  is_super_admin: boolean;
  tenant_id?: string;
  tenant_name?: string;
  signup_source?: string | null;
  signup_share_id?: string | null;
  referral_code?: string;
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
  fit_score?: number | null;
  fit_label?: 'STRONG' | 'STRETCH' | 'MISMATCH' | string | null;
  fit_rationale?: string | null;
  fit_score_breakdown?: {
    coverage_pct: number;
    coverage_score: number;
    seniority: {
      jd: string;
      candidate: string;
      gap: number;
      penalty: number;
    };
    raw_score: number;
    final_score: number;
    fit_label?: string;
    formula: string;
    weights: { SUPPORTED: number; PARTIAL: number; MISSING: number };
    items: Array<{ requirement: string; support: string; weight: number }>;
    counts: { supported: number; partial: number; missing: number };
  } | null;
  evidence_counts?: { supported: number; partial: number; missing: number } | null;
  gap_list?: string[];
  gap_roadmap?: {
    summary?: string;
    steps?: Array<{
      title: string;
      detail: string;
      category?: 'skill' | 'cert' | 'project' | 'experience' | 'other' | string;
    }>;
  } | null;
  jd_analysis?: Record<string, any> | null;
  evidence_map?: {
    items?: Array<{
      requirement: string;
      support: 'SUPPORTED' | 'PARTIAL' | 'MISSING' | string;
      evidence_quote?: string | null;
      transferable_angle?: string | null;
    }>;
    gaps?: string[];
    transferable_themes?: string[];
  } | null;
  ats_score_before?: number | null;
  ats_score_after?: number | null;
  ats_score_detail?: Record<string, any> | null;
  bullet_diff?: {
    experiences?: Array<{
      company?: string;
      role?: string;
      pairs: Array<{ original: string; tailored: string; keyword?: string | null }>;
    }>;
    projects?: Array<{
      name?: string;
      pairs: Array<{ original: string; tailored: string; keyword?: string | null }>;
    }>;
  } | null;
  resume_versions?: Array<{ version: number; label: string }>;
  cover_letter?: string | null;
  interview_packet?: {
    likely_questions?: string[];
    star_stories?: string[];
    elevator_pitch?: string;
    gaps_to_prepare?: string[];
  } | null;
  application_status?: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN' | string;
  applied_at?: string | null;
  applied_via?: 'cold' | 'referral' | 'recruiter_outreach' | string | null;
  follow_up_at?: string | null;
  follow_up_notified_at?: string | null;
  application_notes?: string | null;
  known_contacts?: Array<{
    name: string;
    role?: string;
    relationship?: string;
    email?: string;
    linkedin?: string;
  }> | null;
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
  subscription?: {
    active: boolean;
    plan_name: string;
    monthly_credits: number;
    expires_at: string;
    credits_last_granted_at?: string | null;
    next_credit_grant_hint?: string | null;
  } | null;
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

export interface AdminUserDetail {
  account: {
    id: string;
    email: string;
    name: string;
    is_super_admin: boolean;
    tenant_id?: string;
    tenant_name?: string;
    signup_source?: string;
    signup_ip?: string;
    onboarding_completed: boolean;
    created_at: string;
  };
  jobs: Array<{
    id: number;
    status: string;
    fit_score?: number;
    fit_label?: string;
    ats_score_before?: number;
    ats_score_after?: number;
    application_status?: string;
    applied_via?: string;
    pdf_verified_readable?: boolean;
    pdf_error_log?: string;
    created_at: string;
  }>;
  roasts: Array<{ id: number; status: string; share_id?: string; created_at: string }>;
  referrals: {
    referral_code?: string;
    referred_count: number;
    referred_by?: { id: string; email: string; name: string };
    bonus_granted: boolean;
    bonus_status?: string;
    referral_transactions: Array<{ id: number; amount: number; description?: string; created_at: string }>;
  };
  credits: {
    balance: number;
    daily_free_remaining: number;
    active_time_pass?: { tier_name: string; starts_at: string; expires_at: string };
    recent_transactions: Array<{ id: number; amount: number; type: string; description?: string; created_at: string }>;
  };
  financials: {
    total_llm_cost_usd: number;
    total_revenue_paise: number;
    cost_negative: boolean;
  };
  failures: {
    failed_jobs: Array<{ id: number; status: string; pdf_error_log?: string; pdf_verified_readable?: boolean; created_at: string }>;
    refund_transactions: Array<{ id: number; amount: number; description?: string; created_at: string }>;
  };
}

export interface AdminAuditLogEntry {
  id: number;
  admin_user_id?: string;
  admin_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
  created_at: string;
}

export interface CalibrationRow {
  fit_label: string;
  ats_bucket: string;
  sample_size: number;
  application_rate: number;
  interview_rate: number;
  offer_rate: number;
  below_threshold: boolean;
}

export interface HealthMetrics {
  windows: {
    '24h': { total_jobs: number; phase1_failures: number; pdf_failures: number; unreadable_pdfs: number; refund_count: number; refund_rate_pct: number };
    '7d': { total_jobs: number; phase1_failures: number; pdf_failures: number; unreadable_pdfs: number; refund_count: number; refund_rate_pct: number };
  };
  models: { llm_flash_model: string; llm_pro_model: string };
  golden_matrix?: { is_running: boolean; last_run?: Record<string, unknown> };
}

export interface OpsLiveData {
  timestamp: string;
  jobs_generating_count: number;
  jobs_generating: Array<{ id: number; user_id: string; status: string; created_at: string }>;
  signups_today: number;
  revenue_credits_today: number;
  error_rate_1h_pct: number;
  jobs_last_hour: number;
  failures_last_hour: number;
}

export interface CohortRetentionData {
  cohorts: Array<{ cohort_week: string; signup_count: number; retention: number[] }>;
  week_labels: string[];
}
