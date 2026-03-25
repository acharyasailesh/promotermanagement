'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  ExternalLink, 
  Calendar, 
  CreditCard,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Globe,
  Mail
} from 'lucide-react';

interface License {
  id: string;
  license_key: string;
  plan_tier: string;
  is_active: boolean;
  valid_until: string;
}

interface Tenant {
  id: string;
  company_name: string;
  contact_email: string;
  ceo_name?: string;
  website?: string;
  database_url: string;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  licenses: License[];
}

export default function TenantsManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tenants');
      setTenants(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (!res.ok) throw new Error('Update failed');
      fetchTenants();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteTenant = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This will remove the record from your Master List.`)) return;
    try {
      const res = await fetch(`/api/tenants?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchTenants();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const extendLicense = async (tenant: Tenant, days: number = 30) => {
    const lic = tenant.licenses?.[0];
    if (!lic) return;
    try {
      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays: days, licenseId: lic.id })
      });
      if (!res.ok) throw new Error('Extension failed');
      fetchTenants();
      alert(`Extended ${tenant.company_name} by ${days} days!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sendEmail = async (tenant: Tenant) => {
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id })
      });
      if (!res.ok) throw new Error('Email delivery failed');
      alert(`License expiry notice sent to ${tenant.contact_email}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const filtered = tenants.filter(t => 
    t.company_name.toLowerCase().includes(search.toLowerCase()) ||
    t.contact_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50/50">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Management Console</h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
              <Users size={14} className="text-indigo-500" />
              Overseeing {tenants.length} active corporate environments
            </p>
          </div>
          <button 
            onClick={fetchTenants}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Records
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
              <BuildingIcon size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Tenants</p>
              <p className="text-2xl font-black text-gray-900">{tenants.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-xl text-green-600">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Nodes</p>
              <p className="text-2xl font-black text-gray-900">{tenants.filter(t => t.status === 'active').length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">License Payouts</p>
              <p className="text-2xl font-black text-gray-900">Rs. {tenants.length * 5000}+</p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Search by company name or admin email..."
              className="pl-12 w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Main List */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Corporate Entity</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">License Tier</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Access Key</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Security Status</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Expiry</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-xs uppercase shadow-inner group-hover:bg-white group-hover:scale-110 transition-all">
                          {tenant.company_name.substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{tenant.company_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{tenant.ceo_name || 'No CEO'}</span>
                            {tenant.website && (
                              <a href={tenant.website} target="_blank" className="text-indigo-500 hover:text-indigo-700"><Globe size={10} /></a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-700 w-max border border-indigo-100">
                          {tenant.licenses?.[0]?.plan_tier || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 block truncate w-32">
                          {tenant.licenses?.[0]?.license_key || 'No Key'}
                        </code>
                        {tenant.licenses?.[0]?.license_key && (
                          <button onClick={() => copyToClipboard(tenant.licenses[0].license_key)} className="text-gray-300 hover:text-indigo-600">
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {tenant.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-black text-green-600 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            Authorized
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[11px] font-black text-red-500 uppercase tracking-widest">
                            <XCircle size={12} />
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                          <Calendar size={12} />
                          {tenant.licenses?.[0]?.valid_until ? new Date(tenant.licenses[0].valid_until).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => sendEmail(tenant)}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-blue-500 transition-all"
                            title="Send Expiry Alert"
                         >
                            <Mail size={14} />
                         </button>
                         <button 
                            onClick={() => extendLicense(tenant)}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-amber-500 transition-all"
                            title="Extend 30 Days"
                         >
                            <RefreshCw size={14} />
                         </button>
                         <button 
                            onClick={() => toggleStatus(tenant.id, tenant.status)}
                            className={`p-2 rounded-lg border transition-all ${
                              tenant.status === 'active' 
                                ? 'text-red-500 hover:bg-red-50 border-transparent hover:border-red-100' 
                                : 'text-green-500 hover:bg-green-50 border-transparent hover:border-green-100'
                            }`}
                            title={tenant.status === 'active' ? 'Suspend' : 'Activate'}
                         >
                            {tenant.status === 'active' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                         </button>
                         <button 
                            onClick={() => deleteTenant(tenant.id, tenant.company_name)}
                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                            title="Delete Record"
                         >
                            <XCircle size={14} />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tenants.length === 0 && !loading && (
            <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                <Users size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">No Corporate Entities Found</h3>
                <p className="text-gray-500 text-sm">Provision your first client using the Setup Wizard to see them here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BuildingIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/>
      <path d="M16 6h.01"/>
      <path d="M8 10h.01"/>
      <path d="M16 10h.01"/>
      <path d="M8 14h.01"/>
      <path d="M16 14h.01"/>
    </svg>
  );
}
