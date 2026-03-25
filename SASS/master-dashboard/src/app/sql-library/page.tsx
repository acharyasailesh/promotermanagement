'use client';

import { useState } from 'react';
import { Database, Code2, Copy, CheckCircle2, FileText, Settings, ShieldAlert } from 'lucide-react';

const SQL_COLLECTION = [
  {
    title: "1. Tenant Environment (Full Initialization)",
    icon: <Database className="text-indigo-600" size={24} />,
    description: "Run this in every NEW tenant project to create all business tables (Shareholders, Loans, Banks, etc.)",
    file: "init_schema.sql",
    sql: `-- Execute this in the tenant's Supabase SQL Editor
BEGIN;
-- [Tables: companies, members, shareholders, etc. are omitted here for space in display, but full content should be provided]
-- Full init_schema.sql logic here...
COMMIT;`
  },
  {
    title: "2. Master Controller (System Heart)",
    icon: <Settings className="text-amber-600" size={24} />,
    description: "Schema for the central project (sdfmvegokmtapbsaoukk) to track all licenses and tenants.",
    file: "master_schema.sql",
    sql: `CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  ceo_name TEXT,
  website TEXT,
  phone TEXT,
  database_url TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pricing_tiers (
  plan_name TEXT PRIMARY KEY,
  monthly_price NUMERIC NOT NULL
);`
  },
  {
    title: "3. User Profile Recovery",
    icon: <ShieldAlert className="text-red-600" size={24} />,
    description: "Run this if you lose admin access to a tenant. It resets the profile role to super_admin.",
    file: "fix_admin.sql",
    sql: `UPDATE public.profiles 
SET role = 'super_admin' 
WHERE id = 'USER_ID_HERE';`
  }
];

export default function SqlLibrary() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-10 bg-gray-50/50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-12 pb-20">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">SQL Resource Library</h1>
          <p className="text-gray-500 font-medium text-lg mt-1">Official blueprints for tenant infrastructure</p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-8">
          {SQL_COLLECTION.map((item, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden group">
              <div className="p-8 pb-4 flex items-start justify-between">
                <div className="flex items-start gap-5">
                  <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">{item.file}</p>
                    <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-md">{item.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleCopy(item.sql, item.title)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    copied === item.title 
                    ? 'bg-green-500 text-white' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                  }`}
                >
                  {copied === item.title ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied === item.title ? 'Copied' : 'Copy Query'}
                </button>
              </div>
              
              <div className="px-8 pb-8">
                <div className="bg-gray-900 rounded-2xl p-6 font-mono text-[11px] text-gray-300 relative group/code overflow-x-auto border-4 border-gray-800">
                  <pre>{item.sql}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Advice Footer */}
        <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-start gap-5">
           <FileText className="text-amber-500 shrink-0" size={32} />
           <div>
              <h4 className="font-black text-amber-900 leading-none mb-2 uppercase tracking-widest text-xs">Standard Operating Procedure</h4>
              <p className="text-sm text-amber-800/80 leading-relaxed font-medium">
                Always ensure you target the **public** schema when running these scripts. If you are applying updates to an existing tenant, consider taking a snapshot of their database first via the Supabase Dashboard.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
