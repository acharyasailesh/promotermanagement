'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, Mail, Lock, Loader2, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
       setError(error.message);
       setLoading(false);
    } else {
       router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex bg-indigo-600 p-4 rounded-3xl shadow-2xl shadow-indigo-200 mb-6">
            <Activity className="text-white" size={32} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Master Controller</h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">Restricted access for administrators only.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
              <p className="text-xs text-red-600 font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Admin Identity</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 block w-full outline-none sm:text-sm border-gray-100 rounded-2xl border-2 p-4 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all bg-white"
                  placeholder="admin@tiflsass.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Access Passcode</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 block w-full outline-none sm:text-sm border-gray-100 rounded-2xl border-2 p-4 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Authenticate Identity'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-10 italic">
          Authorized monitoring only. All sessions are logged by the master kernel.
        </p>
      </div>
    </div>
  );
}
