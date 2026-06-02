'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && isLoggedIn && !user?.is_super_admin) {
      router.push('/dashboard');
    }
  }, [isLoading, isLoggedIn, user, router]);

  if (isLoading || !user?.is_super_admin) return null;

  const tabs = [
    { name: 'Overview', href: '/dashboard/admin' },
    { name: 'Users', href: '/dashboard/admin/users' },
    { name: 'Tenants', href: '/dashboard/admin/tenants' },
    { name: 'Credit Config', href: '/dashboard/admin/credits' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid rgba(1,169,219,0.08)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🛡️</span> Admin Console
        </h1>
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          {tabs.map(tab => (
            <Link key={tab.name} href={tab.href} style={{ paddingBottom: 12, borderBottom: `2px solid ${pathname === tab.href ? 'var(--teal)' : 'transparent'}`, color: pathname === tab.href ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: 13, fontWeight: pathname === tab.href ? 600 : 400, textDecoration: 'none', transition: 'all 0.2s ease' }}>
              {tab.name}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {children}
      </div>
    </div>
  );
}
