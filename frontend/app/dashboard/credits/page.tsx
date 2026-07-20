'use client';
import { useState, useEffect } from 'react';
import { creditsApi, paymentsApi } from '@/lib/api/endpoints';
import { CreditPack, TimePassTier, CreditTransaction } from '@/types';
import { useCreditStore } from '@/lib/stores/creditStore';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

function SubscriptionPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { balance, fetchBalance } = useCreditStore();
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    Promise.all([creditsApi.getSubscriptionPlans(), creditsApi.getMySubscription()])
      .then(([p, m]) => {
        setPlans(p.data.plans || []);
        setSub(m.data);
      })
      .catch(() => {});
  }, []);

  const buyPro = async (planId: number) => {
    setProcessingId(planId);
    try {
      const orderRes = await paymentsApi.createOrder('subscription', planId);
      const options = {
        key: orderRes.data.razorpay_key_id,
        amount: orderRes.data.amount_paise,
        currency: orderRes.data.currency,
        name: 'ATS Beater',
        description: 'Job Hunt Pro (30 days)',
        order_id: orderRes.data.order_id,
        handler: async (response: any) => {
          try {
            await paymentsApi.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await fetchBalance();
            const m = await creditsApi.getMySubscription();
            setSub(m.data);
            alert('Job Hunt Pro activated!');
          } catch {
            alert('Payment verification failed.');
          }
        },
        theme: { color: '#01A9DB' },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', () => alert('Payment failed or cancelled.'));
      rzp.open();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start checkout.');
    } finally {
      setProcessingId(null);
    }
  };

  if (!plans.length && !sub?.active && !balance?.subscription?.active) {
    return <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Subscription plans will appear here after migration seed.</p>;
  }

  const activeSub = sub?.subscription || balance?.subscription;

  return (
    <div>
      {(sub?.active || balance?.subscription?.active) && activeSub && (
        <div className="widget-card" style={{ marginBottom: 16, borderColor: 'rgba(16,185,129,0.3)' }}>
          <div>
            Active: <strong>{activeSub.plan_name}</strong> until {formatDate(activeSub.expires_at)}
          </div>
          {activeSub.next_credit_grant_hint && activeSub.next_credit_grant_hint !== 'due_now' && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              Next monthly credit grant around {formatDate(activeSub.next_credit_grant_hint)}
            </div>
          )}
          {activeSub.credits_last_granted_at && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              Last credit grant: {formatDate(activeSub.credits_last_granted_at)}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {plans.map((p) => (
          <div key={p.id} className="widget-card">
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--teal)', marginBottom: 8 }}>{p.name}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatCurrency(p.price_paise)}<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/mo</span></div>
            <ul style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '12px 0 16px', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>{p.monthly_credits} credits / month</li>
              {p.includes_tracker && <li>Application tracker</li>}
              {p.includes_interview_packets && <li>Interview packets</li>}
              {p.includes_extension && <li>Browser extension capture</li>}
            </ul>
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: 12, justifyContent: 'center', marginBottom: isDev ? 8 : 0 }}
              disabled={processingId === p.id}
              onClick={() => buyPro(p.id)}
            >
              {processingId === p.id ? 'Processing…' : 'Subscribe with Razorpay'}
            </button>
            {isDev && (
              <button
                className="btn-secondary"
                style={{ width: '100%', fontSize: 11, justifyContent: 'center' }}
                onClick={async () => {
                  try {
                    await creditsApi.activateSubscriptionDev(p.id);
                    await fetchBalance();
                    const m = await creditsApi.getMySubscription();
                    setSub(m.data);
                    alert('Subscription activated (DEV).');
                  } catch (err: any) {
                    alert(err.response?.data?.detail || 'DEV activation failed');
                  }
                }}
              >
                Activate (DEV)
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const { balance, fetchBalance } = useCreditStore();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [passes, setPasses] = useState<TimePassTier[]>([]);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    Promise.all([
      creditsApi.getPacks(),
      creditsApi.getHistory(1, 10)
    ]).then(([pRes, hRes]) => {
      setPacks(pRes.data.credit_packs.sort((a, b) => a.sort_order - b.sort_order));
      setPasses(pRes.data.time_passes.sort((a, b) => a.sort_order - b.sort_order));
      setHistory(hRes.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleBuy = async (type: 'credit_pack' | 'time_pass', id: number) => {
    setProcessingId(`${type}-${id}`);
    try {
      const orderRes = await paymentsApi.createOrder(type, id);
      const options = {
        key: orderRes.data.razorpay_key_id,
        amount: orderRes.data.amount_paise,
        currency: orderRes.data.currency,
        name: 'ATS Beater',
        description: 'Purchase Credits/Pass',
        order_id: orderRes.data.order_id,
        handler: async (response: any) => {
          try {
            await paymentsApi.verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
            await fetchBalance();
            const hRes = await creditsApi.getHistory(1, 10);
            setHistory(hRes.data.items);
            alert('Payment successful!');
          } catch {
            alert('Payment verification failed.');
          }
        },
        theme: { color: '#01A9DB' }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', () => alert('Payment failed or cancelled.'));
      rzp.open();
    } catch {
      alert('Failed to initiate payment.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    try {
      const res = await creditsApi.redeemPromo(promoCode.trim());
      setPromoMsg({ text: res.data.message, type: 'success' });
      setPromoCode('');
      await fetchBalance();
      const hRes = await creditsApi.getHistory(1, 10);
      setHistory(hRes.data.items);
    } catch (err: any) {
      setPromoMsg({ text: err.response?.data?.detail || 'Invalid code', type: 'error' });
    }
  };

  return (
    <div className="page-scroll">
      <div className="fade-slide-in" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Credits & Billing</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your balance and purchase more credits to generate tailored resumes.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div className="widget-card fade-slide-in stagger-1" style={{ background: 'linear-gradient(135deg, rgba(1,169,219,0.08), rgba(22,43,69,0.8))', borderColor: 'rgba(1,169,219,0.3)' }}>
          <div className="section-label" style={{ margin: 0, color: 'var(--teal)' }}>Current Balance</div>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {balance?.has_unlimited ? '∞' : balance?.balance || 0}
            <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: 0, fontFamily: 'Inter' }}>available credits</span>
          </div>
          {!balance?.has_unlimited && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(15,27,46,0.6)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>🎁</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Daily Free Credits: {balance?.daily_free_remaining} / {balance?.daily_free_total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Resets at midnight UTC</div>
              </div>
            </div>
          )}
        </div>

        <div className="widget-card fade-slide-in stagger-2">
          <div className="section-label" style={{ margin: 0 }}>Redeem Promo Code</div>
          <form onSubmit={handlePromo} style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <input type="text" className="input-field input-mono" placeholder="ENTER-CODE-HERE" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
            <button type="submit" className="btn-secondary" style={{ padding: '0 24px' }}>Redeem</button>
          </form>
          {promoMsg.text && (
            <div style={{ marginTop: 12, fontSize: 12, color: promoMsg.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
              {promoMsg.type === 'success' ? '✅' : '❌'} {promoMsg.text}
            </div>
          )}
        </div>
      </div>

      <div className="fade-slide-in stagger-3" style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Job Hunt Pro (Subscription)</div>
        <SubscriptionPlans />
      </div>

      <div className="fade-slide-in stagger-3" style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Purchase Credits (One-Time)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {packs.map(p => (
            <div key={p.id} className="widget-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{formatCurrency(p.price_paise)}</div>
              <div style={{ fontSize: 14, color: 'var(--teal)', fontWeight: 600, marginBottom: 24 }}>{p.credits} Credits</div>
              <button className="btn-primary" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', fontSize: 12, padding: '10px 0' }} onClick={() => handleBuy('credit_pack', p.id)} disabled={!!processingId}>
                {processingId === `credit_pack-${p.id}` ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {passes.length > 0 && (
        <div className="fade-slide-in stagger-3" style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ marginBottom: 16, color: 'var(--orange)' }}>Unlimited Passes 🚀</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {passes.map(p => (
              <div key={p.id} className="widget-card card-warning" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{p.name}</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{formatCurrency(p.price_paise)}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Unlimited access for {p.duration_days} days</div>
                <button className="btn-primary" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', fontSize: 12, padding: '10px 0' }} onClick={() => handleBuy('time_pass', p.id)} disabled={!!processingId}>
                  {processingId === `time_pass-${p.id}` ? 'Processing...' : 'Get Pass'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="widget-card fade-slide-in stagger-4" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(1,169,219,0.08)' }}>
          <div className="section-label" style={{ margin: 0 }}>Transaction History</div>
        </div>
        
        {loading ? (
          <div style={{ padding: 24 }}><div className="spinner" /></div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32, marginBottom: 16 }}>💸</div>
            <p style={{ fontSize: 13 }}>No transactions yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {history.map(t => (
                  <tr key={t.id}>
                    <td>{formatDate(t.created_at)}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{t.description}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'JetBrains Mono', color: t.amount > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {t.amount > 0 ? '+' : ''}{t.amount}
                    </td>
                    <td><span className={`badge ${t.type.includes('PROMO') ? 'badge-processing' : 'badge-ready'}`}>{t.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
