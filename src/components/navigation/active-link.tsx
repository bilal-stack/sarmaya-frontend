'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type ActiveLinkProps = {
  href: string;
  label: string;
};

export function ActiveLink({ href, label }: ActiveLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        'transition-colors hover:text-foreground',
        isActive ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
    </Link>
  );
}
