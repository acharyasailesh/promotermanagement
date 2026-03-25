'use client';

import { createClient } from '@supabase/supabase-js';

export default function LogoutButton() {
  const handleLogout = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    // Clear the cookie for middleware
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  return (
    <button 
      onClick={handleLogout}
      className="text-[10px] font-black text-red-500 uppercase tracking-widest px-3 py-1.5 rounded-xl border border-red-50 hover:bg-red-50 transition-all font-sans"
    >
      Log Out
    </button>
  );
}
