import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { configStatus } from '../services/supabase';
import { Calendar, AlertCircle, Loader2, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const { session, loading, signIn, resendConfirmationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNeedsConfirmation(false);
    setResendMessage(null);

    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true);
        setFormError(
          'Your email address has not been confirmed yet. Check your Inbox/Spam folder, resend the confirmation email below, or confirm this user in Supabase Dashboard → Authentication → Users.'
        );
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setResendMessage(null);
    try {
      setIsResending(true);
      await resendConfirmationEmail(trimmedEmail);
      setResendMessage(
        'Confirmation email resent! Check Inbox, Spam, and Promotions folders.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend confirmation email.';
      setFormError(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 text-blue-600">
          <Calendar className="w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">MyDay</h1>
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold text-gray-800">
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Manage your tasks, schedules, and daily notes.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-lg sm:px-10">
          {!configStatus.isValid && configStatus.error && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{configStatus.error}</span>
            </div>
          )}

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md space-y-2 text-red-700 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
              {needsConfirmation && email.trim() && (
                <div className="pl-6">
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={handleResend}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-300 rounded hover:bg-red-100 disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isResending ? 'Sending confirmation email...' : 'Resend confirmation email'}
                  </button>
                </div>
              )}
            </div>
          )}

          {resendMessage && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2 text-blue-800 text-xs">
              <Mail className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{resendMessage}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
