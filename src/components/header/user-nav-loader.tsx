'use client';

import dynamic from 'next/dynamic';

const UserNav = dynamic(() => import('@/components/user-nav').then((mod) => mod.UserNav), {
  loading: () => <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />,
});

export function UserNavLoader() {
  return <UserNav />;
}
