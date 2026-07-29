declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response?: unknown) => void) => void;
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Razorpay checkout'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayOrderDetails = {
  order_id: string;
  amount_paise: number;
  currency: string;
  razorpay_key_id?: string;
};

export type RazorpayCheckoutCallbacks = {
  onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
};

export function buildRazorpayOptions(
  order: RazorpayOrderDetails,
  description: string,
  callbacks: RazorpayCheckoutCallbacks,
  opts?: { method?: 'netbanking' | 'card' | 'upi' | 'wallet' }
): Record<string, unknown> {
  const key =
    order.razorpay_key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

  const options: Record<string, unknown> = {
    key,
    amount: order.amount_paise,
    currency: order.currency,
    name: 'Twerz',
    description,
    order_id: order.order_id,
    handler: callbacks.onSuccess,
    theme: { color: '#01A9DB' },
    modal: {
      ondismiss: () => callbacks.onDismiss?.(),
    },
  };

  if (opts?.method) {
    options.method = opts.method;
  }

  return options;
}

export function razorpayFailureMessage(description: string): string {
  if (description.toLowerCase().includes('international')) {
    return (
      'International cards are not enabled on this Razorpay account.\n\n' +
      'For test payments use:\n' +
      '• Netbanking → any bank → Success\n' +
      '• UPI: success@razorpay\n' +
      '• Domestic test card: 5267 3181 8797 5449'
    );
  }
  return description;
}

export async function openRazorpayCheckout(
  options: Record<string, unknown>,
  callbacks?: { onFailure?: (message: string) => void }
) {
  await loadRazorpay();
  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', (response?: unknown) => {
    const err = response as { error?: { description?: string } } | undefined;
    const raw = err?.error?.description || 'Payment failed. Please try again.';
    callbacks?.onFailure?.(razorpayFailureMessage(raw));
  });
  rzp.open();
  return rzp;
}
