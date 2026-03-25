'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database, ShieldCheck, Mail, Building, Key, Loader2, ArrowRight, Users, Plus, Globe } from 'lucide-react';

const PLAN_FEATURES: Record<string, { title: string; price: string; features: string[]; color: string; badge: string }> = {
  standard: {
    title: 'Standard Level',
    price: 'Basic Package',
    badge: 'bg-indigo-100 text-indigo-700',
    color: 'indigo',
    features: [
      'Shareholder Tracking (Up to 100 members)',
      'Dynamic Share Certificate Generation',
      'Investment & Dividend Accounting',
      'Standard Income/Expense Ledger',
      'Real-time Dashboard Statistics',
      'Security Access Control (Super Admin + Editor)',
    ]
  },
  premium: {
    title: 'Premium Level',
    price: 'Advanced Package',
    badge: 'bg-purple-100 text-purple-700',
    color: 'purple',
    features: [
      'Unlimited Shareholders & Certificates',
      'Advanced Loan Management Subsystem',
      'Petty Cash & Bank Reconciliation Logic',
      'AGM Management with Proxy Calculations',
      'Comprehensive Audit Tracing & Security',
      'Add up to 5 Multi-staff Operator roles',
      'Dedicated PDF & CSV Report Exports'
    ]
  },
  enterprise: {
    title: 'Enterprise Unlimited',
    price: 'Enterprise Grade',
    badge: 'bg-green-100 text-green-700',
    color: 'emerald',
    features: [
      'All functionality in Premium level subscription',
      'Specialized Higher Performance Database Node',
      'Direct Direct Instance Snapshot Backups',
      'Multi-Branch/Division Reporting Tiers',
      'Custom Operator Workflows & Logic Modifications',
      'Extended 24/7 Dedicated Priority Technical Desk'
    ]
  }
};

export default function SetupWizard() {
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    ceoName: '',
    website: '',
    databaseUrl: '',
    planTier: 'standard'
  });

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision tenant');
      
      setSuccessData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Tenant Provisioned!</h2>
          <p className="text-gray-500 mb-8 border-b pb-8">
            The database for {formData.companyName} has been initialized with all tables, functions, and RLS policies.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 text-left border mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Tenant Credentials</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-gray-400 mb-1">Company</span>
                <span className="font-semibold text-gray-800">{successData.tenant.company_name}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">Generated License Key (Save this!)</span>
                <code className="text-sm bg-indigo-50 text-indigo-700 px-3 py-2 rounded border border-indigo-100 block break-all font-mono">
                  {successData.license.license_key}
                </code>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">Tier</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                  {successData.license.plan_tier}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setSuccessData(null)} className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2">
              Add Another
              <Plus size={18} />
            </button>
            <Link href="/tenants" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5">
              Go to Management Console
              <Users size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activePlan = PLAN_FEATURES[formData.planTier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.standard;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full flex flex-col md:flex-row bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Left Side: Setup Wizard Form */}
        <div className="flex-1 p-10 space-y-8 border-r border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 border-b pb-4 mb-2">Master Controller</h2>
            <p className="text-sm text-gray-500">
              SaaS Setup Wizard — Provision a new customer tenant automatically.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleProvision}>
            <div className="space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 mb-1">Company Name</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="text-gray-400" size={18} />
                  </div>
                  <input
                    id="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50"
                    placeholder="Everest Investments Pvt Ltd"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-semibold text-gray-700 mb-1">Corporate Admin Email</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="text-gray-400" size={18} />
                  </div>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50"
                    placeholder="admin@everest.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ceoName" className="block text-sm font-semibold text-gray-700 mb-1">CEO / Principal Name</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="text-gray-400" size={18} />
                    </div>
                    <input
                      id="ceoName"
                      type="text"
                      value={formData.ceoName}
                      onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                      className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50"
                      placeholder="Shree Sailesh"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="website" className="block text-sm font-semibold text-gray-700 mb-1">Corporate Website</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="text-gray-400" size={18} />
                    </div>
                    <input
                      id="website"
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50"
                      placeholder="https://everest.com"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="databaseUrl" className="block text-sm font-semibold text-gray-700 mb-1">Tenant Target Database (Supabase Postgres URL)</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Database className="text-gray-400" size={18} />
                  </div>
                  <input
                    id="databaseUrl"
                    type="password"
                    required
                    value={formData.databaseUrl}
                    onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
                    className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50"
                    placeholder="postgresql://postgres:password@db.supabase.co:5432/postgres"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400 italic">This must be a completely blank, new Supabase database.</p>
              </div>

              <div>
                <label htmlFor="planTier" className="block text-sm font-semibold text-gray-700 mb-1">Subscription Plan</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="text-gray-400" size={18} />
                  </div>
                  <select
                    id="planTier"
                    value={formData.planTier}
                    onChange={(e) => setFormData({ ...formData, planTier: e.target.value })}
                    className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50/50 appearance-none pointer"
                  >
                    <option value="standard">Standard Level</option>
                    <option value="premium">Premium Level</option>
                    <option value="enterprise">Enterprise (Unlimited)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg
                  ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 transform hover:-translate-y-0.5'}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    Building Database blueprint...
                  </>
                ) : (
                  'Run Setup Wizard & Provision'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Features Panel Showcase */}
        <div className="w-full md:w-96 bg-gray-50 p-10 flex flex-col justify-center border-t md:border-t-0 border-gray-100">
          <div className="transition-all duration-300">
            <span className={`inline-flex px-3 py-1 text-xs font-black tracking-wide rounded-full uppercase mb-4 ${activePlan.badge}`}>
              {activePlan.price}
            </span>
            <h3 className="text-2xl font-black text-gray-900 mb-1">{activePlan.title}</h3>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold border-b pb-4 mb-4">Plan Inclusions</p>
            
            <ul className="space-y-4">
              {activePlan.features.map((feat, i) => (
                <li key={i} className="flex items-start text-sm text-gray-600 leading-snug">
                  <div className="mt-0.5 mr-2.5">
                    <div className={`p-0.5 rounded-full bg-white border border-${activePlan.color}-200 text-${activePlan.color}-600 shadow-sm`}>
                      <ShieldCheck size={14} />
                    </div>
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 p-4 bg-white/80 backdrop-blur rounded-2xl border border-gray-100 shadow-sm">
              <span className="block text-xs font-bold text-gray-800 mb-1">Automated Setup</span>
              <span className="block text-xs text-gray-400">This tier automatically activates the feature suite directly during initial provisioning sequences immediately without any downtime.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
