'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { FileText, Download, Eye } from 'lucide-react';
import { adToBs } from '@/lib/utils/nepaliDate';
import Link from 'next/link';

type ReportType = 'shareholders' | 'share_collections' | 'expenses' | 'dividends' | 'loans' | 'banking' | 'roi';

export default function ReportsPage() {
  const supabase = createClient();
  const [generating, setGenerating] = useState(false);

  const generateReport = async (type: ReportType) => {
    setGenerating(true);
    try {
      let data: Record<string, unknown>[] = [];
      let filename = '';

      switch (type) {
        case 'shareholders': {
          const res = await supabase.from('shareholders').select('*').is('deleted_at', null).order('first_name');
          data = (res.data || []) as Record<string, unknown>[];
          filename = 'shareholders_report.csv';
          break;
        }
        case 'share_collections': {
          const res = await supabase.from('investments').select('*, shareholders!inner(first_name, last_name)').order('investment_date', { ascending: false });
          data = (res.data || []).map((r: Record<string, unknown>) => {
            const sh = r.shareholders as Record<string, string>;
            return { ...r, shareholder_name: `${sh.first_name} ${sh.last_name}`, date_bs: adToBs(String(r.investment_date)) };
          });
          filename = 'share_collections_report.csv';
          break;
        }
        case 'expenses': {
          const res = await supabase.from('expenses').select('*, expense_categories!inner(name)').is('deleted_at', null).order('expense_date', { ascending: false });
          data = (res.data || []).map((r: Record<string, unknown>) => {
            const cat = r.expense_categories as Record<string, string>;
            return { ...r, category_name: cat.name };
          });
          filename = 'expenses_report.csv';
          break;
        }
        case 'dividends': {
          const res = await supabase.from('dividends').select('*, shareholders!inner(first_name, last_name), fiscal_years!inner(name)');
          data = (res.data || []).map((r: Record<string, unknown>) => {
            const sh = r.shareholders as Record<string, string>;
            const fy = r.fiscal_years as Record<string, string>;
            return { ...r, shareholder_name: `${sh.first_name} ${sh.last_name}`, fiscal_year: fy.name };
          });
          filename = 'dividends_report.csv';
          break;
        }
        case 'loans': {
          const res = await supabase.from('loans').select('*, shareholders!inner(first_name, last_name)');
          data = (res.data || []).map((r: Record<string, unknown>) => {
            const sh = r.shareholders as Record<string, string>;
            return { ...r, shareholder_name: `${sh.first_name} ${sh.last_name}` };
          });
          filename = 'loans_report.csv';
          break;
        }
        case 'banking': {
          const res = await supabase.from('company_banks').select('*').eq('is_active', true);
          data = (res.data || []) as Record<string, unknown>[];
          filename = 'bank_accounts_report.csv';
          break;
        }
        case 'roi': {
          const res = await supabase.from('investment_returns').select('*, company_investments(title), company_banks(bank_name)').is('deleted_at', null);
          data = (res.data || []).map((r: Record<string, unknown>) => {
            const inv = r.company_investments as Record<string, string>;
            const bank = r.company_banks as Record<string, string>;
            return { 
              ...r, 
              investment_title: inv?.title || '',
              bank_name: bank?.bank_name || '',
              return_date_bs: adToBs(String(r.return_date))
            };
          });
          filename = 'roi_returns_report.csv';
          break;
        }
      }

      if (data.length === 0) {
        toast.error('No data to export');
        setGenerating(false);
        return;
      }

      // Convert to CSV
      const exclude = ['shareholders', 'expense_categories', 'fiscal_years'];
      const keys = Object.keys(data[0]).filter(k => !exclude.includes(k));
      const csvRows = [keys.join(',')];
      data.forEach(row => {
        csvRows.push(keys.map(k => {
          const val = row[k];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} report downloaded`);
    } catch {
      toast.error('Failed to generate report');
    }
    setGenerating(false);
  };

  const reports = [
    { type: 'shareholders' as ReportType, title: 'Shareholders Report', desc: 'Export all shareholder details with KYC status' },
    { type: 'lagat' as any, title: 'Shareholder Lagat (Visual)', desc: 'Printable and visual ledger book following standard format', href: '/dashboard/shareholders/lagat' },
    { type: 'share_collections' as ReportType, title: 'Share Collections Report', desc: 'All share collection records with verification status' },
    { type: 'expenses' as ReportType, title: 'Expenses Report', desc: 'Operational expenses by category and date' },
    { type: 'dividends' as ReportType, title: 'Dividends Report', desc: 'Dividend distributions by fiscal year' },
    { type: 'loans' as ReportType, title: 'Loans Report', desc: 'Active and closed loans with repayment info' },
    { type: 'banking' as ReportType, title: 'Banking Overview', desc: 'List of company bank accounts and account details' },
    { type: 'roi' as ReportType, title: 'ROI Returns Report', desc: 'Investment income and ROI returns tracking' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports &amp; Export</h1>
          <p className="page-subtitle">Generate financial reports and data exports</p>
        </div>
      </div>
      <div className="page-body">
        <div className="grid-2">
          {reports.map((r) => (
            <div key={r.type} className="card" style={{ cursor: 'default' }}>
              <div className="flex items-center gap-4">
                <div className="stat-icon purple"><FileText size={22} /></div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{r.desc}</p>
                </div>
                {(r as any).href ? (
                  <Link href={(r as any).href} className="btn btn-primary btn-sm flex items-center gap-1">
                    <Eye size={14} /> View
                  </Link>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => generateReport(r.type)} disabled={generating}>
                    <Download size={14} /> CSV
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
