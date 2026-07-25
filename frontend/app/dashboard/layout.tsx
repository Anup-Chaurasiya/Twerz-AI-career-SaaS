'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCreditStore } from '@/lib/stores/creditStore';
import { notificationsApi } from '@/lib/api/endpoints';
import { OnboardingWelcomeModal } from '@/components/OnboardingWelcomeModal';

const navItems = [
  { href: '/dashboard', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>), label: 'Dashboard' },
  { href: '/dashboard/profiles', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1-2-2"/><path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/></svg>), label: 'Profiles' },
  { href: '/dashboard/jobs', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>), label: 'Jobs' },
  { href: '/dashboard/tracker', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>), label: 'Tracker' },
  { href: '/dashboard/analytics', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>), label: 'Analytics' },
  { href: '/dashboard/roasts', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>), label: 'Roasts' },
  { href: '/dashboard/credits', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>), label: 'Credits' },
  { href: '/dashboard/referrals', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>), label: 'Referrals' },
  { href: '/dashboard/account', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>), label: 'Account' },
];

function formatBreadcrumbSegment(segment: string, index: number, parts: string[]): string {
  if (/^\d+$/.test(segment)) {
    const parent = parts[index - 1];
    if (parent === 'profiles') return 'Profile';
    if (parent === 'jobs') return 'Job';
    if (parent === 'roasts') return 'Roast';
    if (parent === 'users') return 'User';
  }
  return segment.replace(/-/g, ' ');
}

type NotifItem = {
  id: number;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, isLoading, logout } = useAuthStore();
  const { balance, fetchBalance } = useCreditStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifsLoadedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadNotifs = () => {
    notificationsApi.list(false).then((res) => setNotifs(res.data.items || [])).catch(() => {});
  };

  useEffect(() => {
    if (!mounted || isLoading) return;
    const hasToken = !!localStorage.getItem('token');
    if (!isLoggedIn && !hasToken) router.push('/login');
  }, [mounted, isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) {
      notifsLoadedRef.current = false;
      return;
    }
    fetchBalance();
    if (!notifsLoadedRef.current) {
      notifsLoadedRef.current = true;
      loadNotifs();
    }
    const t = setInterval(loadNotifs, 60_000);
    return () => clearInterval(t);
  }, [isLoggedIn, fetchBalance]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div suppressHydrationWarning style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--deep)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-dim)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
    if (hasToken) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--deep)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-dim)' }}>Restoring session...</p>
          </div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--deep)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-dim)' }}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const onNotifClick = async (n: NotifItem) => {
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch { /* ignore */ }
    }
    setNotifOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="app-canvas dashboard-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--deep)', position: 'relative' }}>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ position: 'relative', zIndex: 60 }}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter', fontWeight: 700, fontSize: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, rgba(255,90,31,0.2), rgba(255,90,31,0.05))', border: '1px solid rgba(255,90,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5"><path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1 2-2"/><path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/></svg>
            </div>
            ATS<span style={{ color: 'var(--orange)' }}>Beater</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 4 }}>
            <div className="sidebar-section-label">Navigation</div>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
          {user?.is_super_admin && (
            <div style={{ marginTop: 16 }}>
              <div className="sidebar-section-label">Admin</div>
              <Link href="/dashboard/admin" className={`sidebar-link ${isActive('/dashboard/admin') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Admin Panel
              </Link>
            </div>
          )}
        </nav>

        {balance && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="sidebar-credits">
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>Credits</div>
              {balance.has_unlimited ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', fontFamily: 'Inter' }}>∞ Unlimited</div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter' }}>{balance.balance} <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500 }}>+ {balance.daily_free_remaining} free</span></div>
              )}
            </div>
          </div>
        )}

        <div className="sidebar-user">
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,90,31,0.25), rgba(255,90,31,0.1))', border: '1px solid rgba(255,90,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: 'var(--orange)', flexShrink: 0 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
          <button onClick={logout} className="btn-ghost" style={{ padding: '6px 8px', fontSize: 10, flexShrink: 0 }} title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
              {pathname.split('/').filter(Boolean).map((p, i, arr) => (
                <span key={i}>{i > 0 && ' / '}<span style={{ color: i === arr.length - 1 ? 'var(--text-primary)' : 'var(--text-dim)', textTransform: 'capitalize' }}>{formatBreadcrumbSegment(p, i, arr)}</span></span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="btn-ghost"
                aria-label="Notifications"
                onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) loadNotifs(); }}
                style={{ padding: '6px 8px', position: 'relative' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7,
                    background: 'var(--orange)', color: '#fff', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                    fontFamily: 'JetBrains Mono',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-dropdown animate-fade-in" style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 320, maxHeight: 360,
                  overflowY: 'auto', zIndex: 100,
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--card-border)', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                    NOTIFICATIONS
                  </div>
                  {!notifs.length && (
                    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>No notifications yet</div>
                  )}
                  {notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNotifClick(n)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                        border: 'none', borderBottom: '1px solid #E2E8F0',
                        background: n.is_read ? 'transparent' : 'rgba(255,90,31,0.06)',
                        cursor: 'pointer', color: 'var(--text-primary)',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{n.body}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {balance && !balance.has_unlimited && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,90,31,0.06)', border: '1px solid rgba(255,90,31,0.15)', borderRadius: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>{balance.balance}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(251,65,0,0.15)', border: '1px solid rgba(251,65,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, color: 'var(--orange)' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
      <OnboardingWelcomeModal />
    </div>
  );
}
