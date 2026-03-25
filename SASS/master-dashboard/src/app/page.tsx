'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  Building, 
  Mail, 
  Globe,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface Tenant {
  id: string;
  company_name: string;
  contact_email: string;
  ceo_name?: string;
  website?: string;
  status: string;
  created_at: string;
  licenses: {
    plan_tier: string;
    valid_until: string;
    is_active: boolean;
  }[];
}

const PRICES: Record<string, number> = {
  'Startup': 50,
  'Growth': 150,
  'Enterprise': 500,
  'Enterprise (Unlimited)': 500
};

export default function AnalyticsDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/tenants');
        const data = await res.json();
        if (res.ok) setTenants(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Compute Metrics
  const activeTenants = tenants.filter(t => t.status === 'active');
  const mrr = activeTenants.reduce((acc, t) => {
    const tier = t.licenses?.[0]?.plan_tier || 'Startup';
    return acc + (PRICES[tier] || 0);
  }, 0);

  const expiringSoon = tenants.filter(t => {
    const expiry = t.licenses?.[0]?.valid_until;
    if (!expiry) return false;
    const diff = (new Date(expiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return diff > 0 && diff <= 7;
  });

  const planCounts = tenants.reduce((acc: any, t) => {
    const tier = t.licenses?.[0]?.plan_tier || 'Startup';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="p-20 text-center animate-pulse text-gray-500 font-bold">Loading Business Intelligence...</div>;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-10 bg-gray-50/50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-10 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Command Center</h1>
            <p className="text-gray-500 font-medium text-lg">Global SaaS Performance & Tenant Health Overview</p>
          </div>
          <div className="flex gap-3">
            <Link href="/wizard" className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 flex items-center gap-2">
              <Plus size={20} strokeWidth={3} />
              Deploy New Tenant
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Revenue (MRR)" 
            value={`$${mrr.toLocaleString()}`} 
            icon={<DollarSign size={24} />} 
            color="indigo" 
            trend="+12% growth"
          />
          <StatCard 
            title="Active Entities" 
            value={activeTenants.length.toString()} 
            icon={<Building size={24} />} 
            color="green" 
            trend="+2 this week"
          />
          <StatCard 
            title="Avg. Revenue / User" 
            value={`$${(mrr / (activeTenants.length || 1)).toFixed(0)}`} 
            icon={<BarChart3 size={24} />} 
            color="amber" 
            trend="Stable"
          />
          <StatCard 
            title="Total Environments" 
            value={tenants.length.toString()} 
            icon={<Globe size={24} />} 
            color="blue" 
            trend="Scale: 100%"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Visual Section */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Critical Alerts */}
            <div className={`bg-white rounded-[2rem] p-8 border ${expiringSoon.length > 0 ? 'border-red-200' : 'border-gray-100'} shadow-sm relative overflow-hidden`}>
              {expiringSoon.length > 0 && (
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <AlertTriangle size={120} className="text-red-500" />
                </div>
              )}
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <AlertTriangle className={expiringSoon.length > 0 ? "text-red-500 animate-pulse" : "text-gray-300"} size={24} />
                Critical License Expiries
              </h2>
              {expiringSoon.length > 0 ? (
                <div className="space-y-4">
                  {expiringSoon.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-5 rounded-2xl bg-red-50/50 border border-red-100 group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-red-100 flex items-center justify-center font-black text-red-600">
                          {t.company_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{t.company_name}</p>
                          <p className="text-xs text-red-600 font-black uppercase tracking-widest mt-0.5">
                            Expires in {Math.ceil((new Date(t.licenses[0].valid_until).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-3 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                          <Mail size={16} />
                        </button>
                        <Link href="/tenants" className="px-5 py-3 bg-red-600 text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-all uppercase tracking-widest shadow-lg shadow-red-100">
                          Renew License
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400 font-medium">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-green-500" size={32} />
                  </div>
                  <h3 className="text-gray-900 font-bold mb-1">System All Clear</h3>
                  <p className="text-sm">No immediate license expirations detected.</p>
                </div>
              )}
            </div>

            {/* Plan Distribution Area */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden min-h-[300px]">
               <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={24} />
                Market Share Distribution
               </h2>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                  {Object.entries(planCounts).map(([plan, count]: any) => (
                    <div key={plan} className="relative p-6 rounded-2xl bg-gray-50/50 border border-gray-100 text-center hover:bg-white hover:shadow-xl transition-all duration-300 group">
                       <div className="text-4xl font-black text-indigo-600 mb-2">{count}</div>
                       <p className="text-sm font-black text-gray-900 uppercase tracking-widest leading-tight">{plan}</p>
                       <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
                          {Math.round((count / (tenants.length || 1)) * 100)}% Conversion
                       </p>
                       <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${(count / (tenants.length || 1)) * 100}%` }}
                          />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            
            {/* Quick Summary Section */}
            <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>
               <h3 className="text-xs font-black mb-1 opacity-60 uppercase tracking-widest text-indigo-200">Yearly Revenue Projection</h3>
               <p className="text-5xl font-black mb-8 tracking-tighter">${(mrr * 12).toLocaleString()}</p>
               
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg"><CheckCircle2 size={16} /></div>
                    <p className="text-sm font-medium text-indigo-100">Healthy retention rate</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg"><Users size={16} /></div>
                    <p className="text-sm font-medium text-indigo-100">Scaling as expected</p>
                  </div>
                  <Link href="/tenants" className="block w-full text-center py-4 bg-white text-indigo-900 rounded-2xl font-black transition-all hover:bg-indigo-50 active:scale-95 mt-4">
                     Manage Tenants
                  </Link>
               </div>
            </div>

            {/* Recent Signups */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
               <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center justify-between">
                Recent Signups
                <Link href="/tenants" className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline px-3 py-1 bg-indigo-50 rounded-full">View All</Link>
               </h3>
               <div className="space-y-6">
                {tenants.length > 0 ? tenants.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-4 group">
                     <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-indigo-600 font-black text-sm ring-1 ring-gray-100 transition-colors group-hover:bg-indigo-50 group-hover:ring-indigo-100 shadow-sm">
                      {t.company_name.substring(0, 2).toUpperCase()}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate leading-none mb-1 group-hover:text-indigo-600 transition-colors">{t.company_name}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{t.licenses?.[0]?.plan_tier || 'Trial'}</p>
                     </div>
                     <div className="text-[10px] font-black text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                        {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                     </div>
                  </div>
                )) : (
                  <p className="text-sm text-center text-gray-400 py-4 font-bold">No recent tenants</p>
                )}
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, trend }: { title: string, value: string, icon: any, color: string, trend: string }) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 group relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-8">
          <div className={`p-4 rounded-2xl border ${colors[color]} group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-widest ${trend.includes('+') ? 'text-green-500' : 'text-gray-400'}`}>
            {trend.includes('+') ? <ArrowUpRight size={14} /> : trend.includes('-') ? <ArrowDownRight size={14} /> : <Clock size={14} />}
            {trend}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 opacity-80">{title}</p>
          <p className="text-4xl font-black text-gray-900 tracking-tighter transition-all group-hover:translate-x-1">{value}</p>
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gray-50/50 rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
    </div>
  );
}
