'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth/client';
import { getLaundromatByInviteToken, updateUser } from '@/lib/actions';
import type { Laundromat } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, CheckCircle, Eye, EyeOff } from 'lucide-react';

function InviteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const { data: session, isPending, refetch: refetchSession } = useSession();

  const [laundromat, setLaundromat] = useState<Laundromat | null | undefined>(undefined);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Fetch laundromat by token
  useEffect(() => {
    if (!token) { setLaundromat(null); return; }
    getLaundromatByInviteToken(token).then(setLaundromat);
  }, [token]);

  // If already signed in and laundromat is loaded, auto-connect
  useEffect(() => {
    if (!isPending && session?.user && laundromat && !connected && !connecting) {
      connectUser(session.user.id);
    }
  }, [session, isPending, laundromat, connected, connecting]);

  const connectUser = async (userId: string) => {
    if (!laundromat) return;
    setConnecting(true);
    await updateUser(userId, {
      role: 'laundromat_staff',
      laundromatId: laundromat.id,
    });
    localStorage.setItem('laundromat_portal_id', laundromat.id);
    setConnected(true);
    setConnecting(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laundromat) return;
    setLoading(true);
    setError('');

    if (authTab === 'signup') {
      const { error: signUpError } = await authClient.signUp.email({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      if (signUpError) {
        setError(signUpError.message ?? 'Sign up failed');
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await authClient.signIn.email({
        email: form.email,
        password: form.password,
      });
      if (signInError) {
        setError(signInError.message ?? 'Sign in failed');
        setLoading(false);
        return;
      }
    }

    await refetchSession();
    setLoading(false);
    // connectUser will be triggered by the useEffect above
  };

  // ── Loading token ──
  if (laundromat === undefined || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Store className="h-6 w-6 text-white" />
          </div>
          <p className="text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Invalid token ──
  if (!laundromat) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="text-red-400 text-5xl mb-4">✕</div>
            <p className="text-lg font-semibold">Invalid or expired invite link</p>
            <p className="text-sm text-gray-500 mt-2">Ask your admin to resend the invite.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state ──
  if (connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12 space-y-4">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
            <p className="text-xl font-semibold">You're connected!</p>
            <p className="text-gray-600">Your account is now linked to <strong>{laundromat.name}</strong>.</p>
            <Button className="w-full" onClick={() => router.push('/laundromat')}>
              Go to Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Connecting (signed in, waiting for DB update) ──
  if (connecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Store className="h-6 w-6 text-white" />
          </div>
          <p className="text-gray-500">Connecting to {laundromat.name}…</p>
        </div>
      </div>
    );
  }

  // ── Auth form (not signed in yet) ──
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-md pt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
              <Store className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">You've been invited to manage</CardTitle>
            <p className="text-lg font-bold text-indigo-700 mt-1">{laundromat.name}</p>
            <p className="text-sm text-gray-500 mt-1">Create an account or sign in to accept.</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setAuthTab('signup')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signup' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Create Account
              </button>
              <button
                onClick={() => setAuthTab('signin')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signin' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Sign In
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {authTab === 'signup' && (
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@laundromat.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? (authTab === 'signup' ? 'Creating account…' : 'Signing in…')
                  : (authTab === 'signup' ? 'Create Account & Accept Invite' : 'Sign In & Accept Invite')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center animate-pulse">
          <Store className="h-6 w-6 text-white" />
        </div>
      </div>
    }>
      <InviteInner />
    </Suspense>
  );
}
