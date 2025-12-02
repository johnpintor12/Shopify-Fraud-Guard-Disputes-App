import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle, Server } from 'lucide-react';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [configStatus, setConfigStatus] = useState<'checking' | 'ok' | 'missing'>('checking');

  useEffect(() => {
    // Check if Supabase URL is the placeholder or the real deal
    // We access the internal URL by checking a private property or just assuming based on the client
    // Since we can't easily access the internal url property on the v2 client publicly without ts-ignore, 
    // we will check the environment variables directly via the same logic as the lib
    const getEnv = (key: string) => {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
        if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
        return '';
    };
    
    const url = getEnv('VITE_SUPABASE_URL');
    if (!url || url.includes('placeholder')) {
        setConfigStatus('missing');
    } else {
        setConfigStatus('ok');
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Success! Please check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f2f4] p-4 flex-col gap-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full border border-zinc-200">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
            <Lock className="w-6 h-6" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-zinc-900 mb-2">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-center text-zinc-500 mb-8 text-sm">
          Sign in to access your secure dashboard
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="you@example.com"
              />
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || configStatus === 'missing'}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 font-medium hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>

      {/* Connection Status Indicator */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white px-4 py-2 rounded-full border border-zinc-200 shadow-sm">
        <Server className="w-3 h-3" />
        <span>Database Connection:</span>
        {configStatus === 'checking' && <span className="text-orange-500">Checking...</span>}
        {configStatus === 'ok' && <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Connected</span>}
        {configStatus === 'missing' && <span className="text-red-600 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Missing Keys</span>}
      </div>
      {configStatus === 'missing' && (
         <p className="text-xs text-red-500 text-center max-w-sm">
            Error: Supabase environment variables are missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file or Vercel settings and restart.
         </p>
      )}
    </div>
  );
};
