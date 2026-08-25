
'use client';
import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

const FALLBACK_INITIALS = '??';

function getInitials(fullName: string | null | undefined) {
  if (!fullName) return FALLBACK_INITIALS;
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return FALLBACK_INITIALS;
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0][0]}${tokens[tokens.length - 1][0]}`.toUpperCase();
}

export function UserNav() {
  const { user, logout, isLoading } = useAuth();

  // Above the early returns, not below them. React identifies hooks by call
  // order, so a useMemo that only runs once `user` has loaded means the first
  // render registers fewer hooks than the second — and React throws "rendered
  // more hooks than during the previous render" the moment isLoading flips.
  // Both memos therefore have to tolerate `user` being null.
  // Above the early returns, not below them. React identifies hooks by call
  // order, so a useMemo reached only once `user` has loaded registers fewer
  // hooks on a render that returned early than on one that did not — and React
  // refuses that with "rendered more hooks than during the previous render".
  //
  // Today it is masked rather than firing: UserNav is a next/dynamic import,
  // so its chunk lands after the auth context has already read localStorage
  // and flipped isLoading to false, and the early return is almost never taken
  // on a first render. Confirmed by putting the hooks back below the returns
  // and failing to reproduce a crash. That makes this a latent violation, not
  // a live bug — it starts firing the day the dynamic import is dropped or the
  // session check becomes genuinely async. Both memos therefore tolerate a
  // null user and sit where their order cannot change.
  const initials = useMemo(
    () => (user ? getInitials(user.full_name) : ''),
    [user],
  );
  const avatarSrc = useMemo(
    () => (user ? `https://picsum.photos/seed/${user.id}/40/40` : ''),
    [user],
  );

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc} alt={user.full_name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account">Settings</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
