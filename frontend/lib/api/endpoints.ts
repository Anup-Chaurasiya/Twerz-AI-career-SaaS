import client from './client';
import {
  User, LoginResponse, Profile, ProfileUploadResponse, PaginatedResponse,
  Job, JobCreatePayload, Roast, RoastUploadResponse, CreditPack, TimePassTier,
  CreditBalance, CreditTransaction, CreateOrderResponse, ChatMessage,
  AdminOverview, Tenant, AdminUser, DomainRule, PromoCode, ResumeInfo,
} from '@/types';

export const authApi = {
  getGoogleLoginUrl: () => client.get<LoginResponse>('/auth/google/login'),
  getMe: () => client.get<User>('/auth/me'),
  refresh: () => client.post<{ access_token: string }>('/auth/refresh'),
  completeOnboarding: () =>
    client.post<{ success: boolean; onboarding_completed: boolean }>('/auth/onboarding-complete'),
  setAttribution: (payload: { source: string; share_id?: string | null }) =>
    client.post<{
      success: boolean;
      updated: boolean;
      signup_source: string | null;
      signup_share_id: string | null;
    }>('/auth/attribution', payload),
};

export const profilesApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<ProfileUploadResponse>('/profiles/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (page = 1, limit = 10) =>
    client.get<PaginatedResponse<Profile>>(`/profiles?page=${page}&limit=${limit}`),
  get: (id: number) => client.get<Profile>(`/profiles/${id}`),
  getStatus: (id: number) => client.get<{ id: number; status: string }>(`/profiles/${id}/status`),
  update: (id: number, resumeInfo: ResumeInfo) =>
    client.put<Profile>(`/profiles/${id}`, { resume_info: resumeInfo }),
  enhance: (id: number) => client.post<Profile>(`/profiles/${id}/enhance`),
  delete: (id: number) => client.delete(`/profiles/${id}`),
};

export const jobsApi = {
  list: (page = 1, limit = 10) =>
    client.get<PaginatedResponse<Job>>(`/jobs?page=${page}&limit=${limit}`),
  create: (payload: JobCreatePayload) =>
    client.post<{ job_id: number; status: string }>('/jobs', payload),
  get: (id: number) => client.get<Job>(`/jobs/${id}`),
  getStatus: (id: number) => client.get<{ id: number; status: string }>(`/jobs/${id}/status`),
  generateResume: (id: number, opts?: { confirm_low_fit?: boolean }) =>
    client.post<{ job_id: number; status: string }>(`/jobs/${id}/generate-resume`, {
      confirm_low_fit: opts?.confirm_low_fit ?? false,
    }),
  generatePdf: (id: number) =>
    client.post<{ job_id: number; status: string }>(`/jobs/${id}/generate-pdf`),
  analyzeFit: (id: number) =>
    client.post<{
      job_id: number;
      fit_score: number;
      fit_label: string;
      fit_rationale: string;
      fit_score_breakdown?: Job['fit_score_breakdown'];
      evidence_counts?: Job['evidence_counts'];
      gap_list: string[];
      gap_roadmap?: Job['gap_roadmap'];
      jd_analysis?: Job['jd_analysis'];
      evidence_map?: Job['evidence_map'];
    }>(`/jobs/${id}/analyze-fit`),
  fixGaps: (id: number, keywords: string[]) =>
    client.post<{ success: boolean; custom_resume_data: ResumeInfo; status: string }>(
      `/jobs/${id}/fix-gaps`,
      { keywords }
    ),
  restoreVersion: (id: number, version: number) =>
    client.post<{ success: boolean; custom_resume_data: ResumeInfo; status: string }>(
      `/jobs/${id}/restore-version`,
      { version }
    ),
  generateCoverLetter: (id: number) =>
    client.post<{ cover_letter: string }>(`/jobs/${id}/cover-letter`),
  generateInterviewPacket: (id: number) =>
    client.post<{ interview_packet: Job['interview_packet'] }>(`/jobs/${id}/interview-packet`),
  updateApplication: (
    id: number,
    payload: {
      application_status?: string;
      application_notes?: string;
      follow_up_at?: string | null;
    }
  ) => client.patch(`/jobs/${id}/application`, payload),
  updateCustomResume: (id: number, customResumeData: ResumeInfo) =>
    client.put<{ success: boolean; job: Partial<Job> }>(`/jobs/${id}/custom-resume`, customResumeData),
  downloadPdf: async (id: number): Promise<Blob> => {
    const response = await client.get(`/jobs/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  downloadDocx: async (id: number): Promise<Blob> => {
    const response = await client.get(`/jobs/${id}/docx`, { responseType: 'blob' });
    return response.data;
  },
  getChatHistory: (id: number) =>
    client.get<{ messages: ChatMessage[] }>(`/jobs/${id}/chat/history`),
};

export const roastsApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<RoastUploadResponse>('/roasts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (page = 1, limit = 10) =>
    client.get<PaginatedResponse<Roast>>(`/roasts?page=${page}&limit=${limit}`),
  get: (id: number) => client.get<Roast>(`/roasts/${id}`),
  getShared: (shareId: string) =>
    client.get<{ share_id: string; roast_data: any; created_at: string }>(`/roasts/shared/${shareId}`),
  getStatus: (id: number) => client.get<{ id: number; status: string }>(`/roasts/${id}/status`),
};

export const creditsApi = {
  getPacks: () =>
    client.get<{ credit_packs: CreditPack[]; time_passes: TimePassTier[] }>('/credits/packs'),
  getBalance: () => client.get<CreditBalance>('/credits/me'),
  getHistory: (page = 1, limit = 20, search = '') =>
    client.get<PaginatedResponse<CreditTransaction>>(
      `/credits/history?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    ),
  redeemPromo: (code: string) =>
    client.post<{ message: string; balance: CreditBalance }>('/credits/redeem-promo', { code }),
  getSubscriptionPlans: () =>
    client.get<{
      plans: Array<{
        id: number;
        name: string;
        monthly_credits: number;
        price_paise: number;
        includes_tracker: boolean;
        includes_interview_packets: boolean;
        includes_extension: boolean;
      }>;
    }>('/credits/subscriptions'),
  getMySubscription: () =>
    client.get<{ active: boolean; subscription: any }>('/credits/subscriptions/me'),
  activateSubscriptionDev: (planId: number) =>
    client.post(`/credits/subscriptions/${planId}/activate-dev`),
};

export const paymentsApi = {
  createOrder: (itemType: 'credit_pack' | 'time_pass' | 'subscription', itemId: number) =>
    client.post<CreateOrderResponse>('/payments/create-order', {
      item_type: itemType,
      item_id: itemId,
    }),
  verifyPayment: (razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) =>
    client.post<{ status: string; balance: CreditBalance }>('/payments/verify', {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    }),
};

export const adminApi = {
  getOverview: () => client.get<AdminOverview>('/admin/overview'),
  listTenants: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<Tenant>>(`/admin/tenants?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  createTenant: (name: string) => client.post<Tenant>('/admin/tenants', { name }),
  updateTenant: (id: string, name: string) => client.put<Tenant>(`/admin/tenants/${id}`, { name }),
  deleteTenant: (id: string) => client.delete(`/admin/tenants/${id}`),
  listUsers: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<AdminUser>>(`/admin/users?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  assignTenant: (userId: string, tenantId: string | null) =>
    client.put(`/admin/users/${userId}/tenant`, { tenant_id: tenantId }),
  listDomainRules: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<DomainRule>>(`/admin/domain-rules?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  createDomainRule: (domain: string, tenantId: string) =>
    client.post<DomainRule>('/admin/domain-rules', { domain, tenant_id: tenantId }),
  deleteDomainRule: (id: number) => client.delete(`/admin/domain-rules/${id}`),
  listCreditPacks: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<CreditPack>>(`/admin/credit-packs?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  createCreditPack: (data: { name: string; credits: number; price_paise: number; is_active: boolean; sort_order: number }) =>
    client.post<CreditPack>('/admin/credit-packs', data),
  updateCreditPack: (id: number, data: Partial<CreditPack>) =>
    client.put<CreditPack>(`/admin/credit-packs/${id}`, data),
  deleteCreditPack: (id: number) => client.delete(`/admin/credit-packs/${id}`),
  listTimePassTiers: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<TimePassTier>>(`/admin/time-pass-tiers?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  createTimePassTier: (data: { name: string; duration_days: number; price_paise: number; is_active: boolean; sort_order: number }) =>
    client.post<TimePassTier>('/admin/time-pass-tiers', data),
  updateTimePassTier: (id: number, data: Partial<TimePassTier>) =>
    client.put<TimePassTier>(`/admin/time-pass-tiers/${id}`, data),
  deleteTimePassTier: (id: number) => client.delete(`/admin/time-pass-tiers/${id}`),
  listPromoCodes: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<PromoCode>>(`/admin/promo-codes?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  createPromoCode: (data: { code: string; type: 'CREDITS' | 'TIME_PASS'; value: number; max_redemptions: number; is_active: boolean; expires_at?: string }) =>
    client.post<PromoCode>('/admin/promo-codes', data),
  updatePromoCode: (id: number, data: { is_active?: boolean; max_redemptions?: number; expires_at?: string | null }) =>
    client.put<PromoCode>(`/admin/promo-codes/${id}`, data),
  deletePromoCode: (id: number) => client.delete(`/admin/promo-codes/${id}`),
  grantCredits: (userId: string, amount: number, description?: string) =>
    client.post('/admin/credits/grant', { user_id: userId, amount, description }),
  getUserCredits: (userId: string, page = 1, size = 20) =>
    client.get(`/admin/credits/user/${userId}?page=${page}&size=${size}`),
  listTransactions: (page = 1, size = 50, search = '') =>
    client.get<PaginatedResponse<CreditTransaction>>(`/admin/transactions?page=${page}&size=${size}&search=${encodeURIComponent(search)}`),
  getShareAnalyticsSummary: () =>
    client.get<{
      total_views: number;
      unique_ips: number;
      signup_attributions: number;
      top_platforms: Array<{ name: string; count: number }>;
      top_browsers: Array<{ name: string; count: number }>;
      top_os: Array<{ name: string; count: number }>;
      views_by_day: Array<{ date: string; count: number }>;
    }>('/admin/share-analytics/summary'),
};

export const healthApi = {
  check: () => client.get<{ status: string }>('/health'),
};

export const notificationsApi = {
  list: (unreadOnly = false) =>
    client.get<{
      items: Array<{
        id: number;
        title: string;
        body: string;
        kind: string;
        link: string | null;
        is_read: boolean;
        created_at: string;
      }>;
    }>(`/notifications?unread_only=${unreadOnly}`),
  markRead: (id: number) => client.post<{ success: boolean }>(`/notifications/${id}/read`),
};
