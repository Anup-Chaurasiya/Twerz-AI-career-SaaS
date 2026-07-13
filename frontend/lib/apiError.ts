export interface ApiErrorResponse {
  message: string;
  shouldRedirect?: boolean;
  redirectUrl?: string;
  actionText?: string;
  actionUrl?: string;
}

export function handleApiError(error: any): ApiErrorResponse {
  const status = error.response?.status;
  const errorData = error.response?.data;
  
  // Handle specific error types from backend
  if (errorData?.error === 'insufficient_credits') {
    return {
      message: "You've run out of credits.",
      actionText: 'Top Up Credits',
      actionUrl: '/dashboard/credits'
    };
  }
  
  if (errorData?.error === 'rate_limited') {
    const retryAfter = errorData?.retry_after_seconds;
    const waitTime = retryAfter ? `${Math.ceil(retryAfter / 60)} minutes` : 'a moment';
    return {
      message: `Too many requests. Please wait ${waitTime} and try again.`
    };
  }

  // Handle by HTTP status code
  switch (status) {
    case 401:
      // Auto-redirect after showing message
      setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }, 2000);
      return {
        message: 'Your session has expired. Logging you out...',
        shouldRedirect: true,
        redirectUrl: '/login'
      };

    case 403:
      return {
        message: "You don't have permission to do this."
      };

    case 404:
      return {
        message: 'This page or resource was not found.'
      };

    case 429:
      // Check if it's credits or rate limit
      if (errorData?.detail?.toLowerCase().includes('credit')) {
        return {
          message: "You've run out of credits.",
          actionText: 'Top Up Credits',
          actionUrl: '/dashboard/credits'
        };
      }
      return {
        message: 'Too many requests. Please wait a moment and try again.'
      };

    case 500:
      return {
        message: "Something went wrong on our end. We've been notified."
      };

    case 503:
      return {
        message: 'Service is temporarily unavailable. Please try again in a minute.'
      };

    default:
      // Network error or unknown
      if (error.message === 'Network Error' || !error.response) {
        return {
          message: "Can't connect. Check your internet connection."
        };
      }
      
      // Generic fallback
      return {
        message: errorData?.detail || error.message || 'An unexpected error occurred.'
      };
  }
}

export function isNetworkError(error: any): boolean {
  return error.message === 'Network Error' || !error.response;
}

export function isCreditError(error: any): boolean {
  return error.response?.data?.error === 'insufficient_credits' ||
         (error.response?.status === 429 && 
          error.response?.data?.detail?.toLowerCase().includes('credit'));
}

export function isRateLimitError(error: any): boolean {
  return error.response?.data?.error === 'rate_limited' ||
         (error.response?.status === 429 && 
          !error.response?.data?.detail?.toLowerCase().includes('credit'));
}
