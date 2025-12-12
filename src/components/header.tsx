import Link from 'next/link';
import { GalsiLogo } from '@/components/auth/galsi-logo';
import { ActiveLink } from '@/components/navigation/active-link';

import { UserNavLoader } from '@/components/header/user-nav-loader';

const navLinks = [
    { href: "/ai-tools", label: "AI Tools" },
    { href: "/pricing", label: "Pricing" },
]

export function Header() {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex w-full items-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <GalsiLogo className="h-6 w-6" />
          <span className="sr-only">Galsi</span>
        </Link>
        <nav className="hidden w-full justify-center text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          {navLinks.map((link) => (
            <ActiveLink key={link.href} href={link.href} label={link.label} />
          ))}
        </nav>
        <div className="flex flex-1 items-center justify-end">
          <UserNavLoader />
        </div>
      </div>
    </header>
  );
}
