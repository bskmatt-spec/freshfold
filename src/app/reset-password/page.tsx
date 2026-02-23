'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, Eye, EyeOff, CheckCircle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!token) { setError('Invalid or expired reset link.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    if (err) {
      setError(err.message ?? 'Reset failed. The link may have expired.');
    } else {
      setDone(true);
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <p className="text-center text-red-500">Invalid reset link. Please request a new one.</p>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <p className="font-semibold text-lg">Password updated!</p>
        <p className="text-gray-600 text-sm">You can now sign in with your new password.</p>
        <Button className="w-full mt-2" onClick={() => window.location.href = '/customer'}>
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="new-password">New Password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            className="pr-10"
          />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating…' : 'Set New Password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
            <Shirt className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-gray-600 mt-1">Choose a strong password for your account</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Suspense fallback={<p className="text-center text-gray-500">Loading…</p>}>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
