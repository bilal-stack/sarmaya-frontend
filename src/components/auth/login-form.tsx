"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Mail, Lock, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/api-config';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoginSchema } from '@/lib/schemas';

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  // Set when /auth/login answers `mfa_required`. It authenticates nothing on
  // its own and expires in minutes; holding it in state rather than storing it
  // is deliberate, so an abandoned sign-in leaves nothing behind.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof LoginSchema>) {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Something went wrong');
      }

      // The password was right but the sign-in is not finished. Before this
      // existed the response fell through to the else below and reported
      // "Login failed", so anybody who turned on a second factor was locked
      // out of this app with an error that never mentioned it.
      if (result.mfa_required && result.challenge_token) {
        setChallengeToken(result.challenge_token);
        return;
      }

      if (result.access_token && result.token_type === 'bearer' && result.user) {
        // Combine user data with token info
        const userData = {
          ...result.user,
          access_token: result.access_token,
          token_type: result.token_type,
        };
        login(userData);
      } else {
        throw new Error(result.detail || 'Login failed');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'Could not complete login.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.MFA_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_token: challengeToken, code: code.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'That code was not accepted.');
      }
      login({
        ...result.user,
        access_token: result.access_token,
        token_type: result.token_type,
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not verify',
        description:
          error instanceof Error ? error.message : 'That code was not accepted.',
      });
      setCode('');
    } finally {
      setIsLoading(false);
    }
  }

  // Second step. The password form is replaced rather than added to, so there
  // is one obvious thing to do and no stale password sitting in a field.
  if (challengeToken) {
    return (
      <form onSubmit={submitCode} className="space-y-6">
        <div className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Your password was accepted. Enter the six-digit code from your
            authenticator app, or one of your recovery codes.
          </span>
        </div>

        <div className="space-y-2">
          <label htmlFor="mfa-code" className="text-sm font-medium">
            Code
          </label>
          <Input
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            // Not type="number": a recovery code is not numeric, and the same
            // box takes either.
            inputMode="text"
            autoFocus
            className="tracking-widest"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            // Drop the challenge rather than keeping it around; starting over
            // means starting over.
            setChallengeToken(null);
            setCode('');
            form.reset();
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Start again
        </Button>
      </form>
    );
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="********"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log In
        </Button>
      </form>
    </Form>
  );
}
