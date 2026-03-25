'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Password updated successfully!');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="sidebar-logo-icon" style={{ width: 48, height: 48, fontSize: 20 }}>
              GB
            </div>
          </div>
          <h1 className="login-title">Create New Password</h1>
          <p className="login-subtitle">Enter your new secure password below</p>
        </div>

        <form onSubmit={handleResetPassword} className="login-form">
          <div className="input-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>

        <p className="login-footer">
          Pokhara, Newroad &bull; Secure Admin Portal
        </p>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.4;
        }
        .login-orb-1 {
          width: 400px;
          height: 400px;
          background: #6366f1;
          top: -10%;
          right: -5%;
          animation: float 8s ease-in-out infinite;
        }
        .login-orb-2 {
          width: 300px;
          height: 300px;
          background: #8b5cf6;
          bottom: -5%;
          left: -5%;
          animation: float 10s ease-in-out infinite reverse;
        }
        .login-orb-3 {
          width: 200px;
          height: 200px;
          background: #a78bfa;
          top: 40%;
          left: 50%;
          animation: float 12s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        .login-card {
          background: rgba(22, 22, 31, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 48px 40px;
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 10;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
        }
        .login-header {
          text-align: center;
          margin-bottom: 36px;
        }
        .login-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }
        .login-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.3px;
          margin-bottom: 4px;
        }
        .login-subtitle {
          font-size: 14px;
          color: var(--text-muted);
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .login-footer {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 28px;
        }
        @media (max-width: 480px) {
          .login-card {
            margin: 16px;
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
}
