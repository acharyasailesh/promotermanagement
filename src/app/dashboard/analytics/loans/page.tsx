'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Banknote,
  CreditCard,
  Wallet,
  CheckCircle2,
  Clock,
  BarChart2,
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import NepaliDateInput from '../../components/NepaliDateInput';

interface LoanRaw {
  id: string;
  shareholder_id: string;
  principal: number;
  interest_rate: number;
  issue_date: string;
  due_date: string | null;
  amount_repaid: number;
  status: string;
  shareholders: { first_name: string; last_name: string };
}

interface InstallmentRaw {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  status: string;
}

const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  active: '#6366f1',
  closed: '#22c55e',
  overdue: '#ef4444',
};

export default function LoanAnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  // Raw data
  const [rawLoans, setRawLoans] = useState<LoanRaw[]>([]);
  const [rawInstallments, setRawInstallments] = useState<InstallmentRaw[]>([]);
  const [uniqueRates, setUniqueRates] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // ── Filter States ──────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMinRate, setFilterMinRate] = useState<string>('');
  const [filterMaxRate, setFilterMaxRate] = useState<string>('');
  const [filterIssueDateFrom, setFilterIssueDateFrom] = useState('');
  const [filterIssueDateTo, setFilterIssueDateTo] = useState('');
  const [filterMinPrincipal, setFilterMinPrincipal] = useState('');
  const [filterMaxPrincipal, setFilterMaxPrincipal] = useState('');
  const [filterHasOverdue, setFilterHasOverdue] = useState<'all' | 'yes' | 'no'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loanRes, instRes] = await Promise.all([
        supabase
          .from('loans')
          .select('id, shareholder_id, principal, interest_rate, issue_date, due_date, amount_repaid, status, shareholders!loans_shareholder_id_fkey(first_name, last_name)')
          .is('deleted_at', null),
        supabase
          .from('loan_installments')
          .select('id, loan_id, installment_no, due_date, principal_amount, interest_amount, total_amount, status'),
      ]);

      const loans = (loanRes.data || []) as unknown as LoanRaw[];
      const insts = (instRes.data || []) as unknown as InstallmentRaw[];
      setRawLoans(loans);
      setRawInstallments(insts);

      const rates = [...new Set(loans.map(l => Number(l.interest_rate)))].sort((a, b) => a - b);
      setUniqueRates(rates);
    } catch (err) {
      console.error('Error fetching loan data:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = filterStatus !== 'all' || filterMinRate || filterMaxRate ||
    filterIssueDateFrom || filterIssueDateTo || filterMinPrincipal || filterMaxPrincipal || filterHasOverdue !== 'all';

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterMinRate('');
    setFilterMaxRate('');
    setFilterIssueDateFrom('');
    setFilterIssueDateTo('');
    setFilterMinPrincipal('');
    setFilterMaxPrincipal('');
    setFilterHasOverdue('all');
  };

  // ── Derived: overdue loan IDs ──────────────────────────────────────────
  const overdueInstallments = useMemo(() => {
    const today = new Date();
    return rawInstallments.filter(
      i => i.status === 'pending' && i.installment_no > 0 && new Date(i.due_date) < today
    );
  }, [rawInstallments]);

  const overdueByLoan = useMemo(() => {
    const map: Record<string, number> = {};
    overdueInstallments.forEach(i => { map[i.loan_id] = (map[i.loan_id] || 0) + 1; });
    return map;
  }, [overdueInstallments]);

  // ── Apply Filters ──────────────────────────────────────────────────────
  const filteredLoans = useMemo(() => {
    const minRate = filterMinRate ? parseFloat(filterMinRate) : null;
    const maxRate = filterMaxRate ? parseFloat(filterMaxRate) : null;
    const minPrin = filterMinPrincipal ? parseFloat(filterMinPrincipal) : null;
    const maxPrin = filterMaxPrincipal ? parseFloat(filterMaxPrincipal) : null;

    return rawLoans.filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (minRate !== null && Number(l.interest_rate) < minRate) return false;
      if (maxRate !== null && Number(l.interest_rate) > maxRate) return false;
      if (filterIssueDateFrom && l.issue_date < filterIssueDateFrom) return false;
      if (filterIssueDateTo && l.issue_date > filterIssueDateTo) return false;
      if (minPrin !== null && Number(l.principal) < minPrin) return false;
      if (maxPrin !== null && Number(l.principal) > maxPrin) return false;
      if (filterHasOverdue === 'yes' && !overdueByLoan[l.id]) return false;
      if (filterHasOverdue === 'no' && overdueByLoan[l.id]) return false;
      return true;
    });
  }, [rawLoans, filterStatus, filterMinRate, filterMaxRate, filterIssueDateFrom, filterIssueDateTo, filterMinPrincipal, filterMaxPrincipal, filterHasOverdue, overdueByLoan]);

  // ── Analytics Computations ─────────────────────────────────────────────
  const kpis = useMemo(() => {
    let active = 0, closed = 0, totalDisbursed = 0, totalRepaid = 0;
    filteredLoans.forEach(l => {
      totalDisbursed += Number(l.principal);
      totalRepaid += Number(l.amount_repaid);
      if (l.status === 'active') active++;
      else if (l.status === 'closed') closed++;
    });
    const totalOutstanding = totalDisbursed - totalRepaid;

    const filteredLoanIds = new Set(filteredLoans.map(l => l.id));
    let interestCollected = 0;
    rawInstallments.forEach(i => {
      if (filteredLoanIds.has(i.loan_id) && i.status === 'paid' && i.installment_no > 0) {
        interestCollected += Number(i.interest_amount);
      }
    });

    return { active, closed, totalDisbursed, totalOutstanding, totalRepaid, interestCollected, total: filteredLoans.length };
  }, [filteredLoans, rawInstallments]);

  const statusDist = useMemo(() => {
    const m: Record<string, number> = { active: 0, closed: 0, overdue: 0 };
    filteredLoans.forEach(l => { m[l.status] = (m[l.status] || 0) + 1; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filteredLoans]);

  const loanTrend = useMemo(() => {
    const monthMap: Record<string, { disbursed: number; repaid: number }> = {};
    filteredLoans.forEach(l => {
      const d = new Date(l.issue_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { disbursed: 0, repaid: 0 };
      monthMap[key].disbursed += Number(l.principal);
      monthMap[key].repaid += Number(l.amount_repaid);
    });
    return Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));
  }, [filteredLoans]);

  const rateDistribution = useMemo(() => {
    const m: Record<string, number> = {};
    filteredLoans.forEach(l => {
      const key = `${Number(l.interest_rate)}%`;
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m).map(([rate, count]) => ({ rate, count })).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
  }, [filteredLoans]);

  const principalRangeDist = useMemo(() => {
    let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0;
    filteredLoans.forEach(l => {
      const p = Number(l.principal);
      if (p <= 50000) r1++;
      else if (p <= 200000) r2++;
      else if (p <= 500000) r3++;
      else if (p <= 1000000) r4++;
      else r5++;
    });
    return [
      { range: '≤50K', count: r1 },
      { range: '50K–2L', count: r2 },
      { range: '2L–5L', count: r3 },
      { range: '5L–10L', count: r4 },
      { range: '10L+', count: r5 },
    ].filter(d => d.count > 0);
  }, [filteredLoans]);

  const topBorrowers = useMemo(() => {
    return filteredLoans
      .map(l => ({
        name: `${l.shareholders.first_name} ${l.shareholders.last_name}`,
        principal: Number(l.principal),
        outstanding: Math.max(0, Number(l.principal) - Number(l.amount_repaid)),
        rate: Number(l.interest_rate),
        status: l.status,
        hasOverdue: !!overdueByLoan[l.id],
        overdueCount: overdueByLoan[l.id] || 0,
      }))
      .sort((a, b) => b.principal - a.principal)
      .slice(0, 10);
  }, [filteredLoans, overdueByLoan]);

  const filteredOverdue = useMemo(() => {
    const today = new Date();
    const filteredLoanIds = new Set(filteredLoans.map(l => l.id));
    return rawInstallments
      .filter(i => filteredLoanIds.has(i.loan_id) && i.status === 'pending' && i.installment_no > 0 && new Date(i.due_date) < today)
      .map(i => {
        const loan = rawLoans.find(l => l.id === i.loan_id);
        return {
          borrower: loan ? `${loan.shareholders.first_name} ${loan.shareholders.last_name}` : '—',
          dueDate: i.due_date,
          amount: Number(i.total_amount),
          daysOverdue: Math.ceil((today.getTime() - new Date(i.due_date).getTime()) / 86400000),
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 12);
  }, [filteredLoans, rawInstallments, rawLoans]);

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading Loan Analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', padding: '24px', margin: '-24px' }}>

      {/* Page Header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link href="/dashboard/analytics" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Analytics
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'rgba(99,102,241,0.15)', padding: '11px 13px', borderRadius: 12, color: '#6366f1' }}>
              <Banknote size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontWeight: 800, fontSize: 22, color: 'var(--text-primary)' }}>Loan Portfolio Analytics</h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Deep analysis of shareholder loan activity, repayments & risk
                {hasActiveFilters && <span style={{ marginLeft: 8, background: 'rgba(99,102,241,0.12)', color: '#6366f1', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Filtered: {filteredLoans.length}/{rawLoans.length} loans</span>}
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, position: 'relative' }}
          >
            <Filter size={14} />
            Filters
            <ChevronDown size={13} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            {hasActiveFilters && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#6366f1', borderRadius: '50%' }} />
            )}
          </button>
        </div>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Filter size={14} style={{ color: '#6366f1' }} /> Filter Loans
            </div>
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={12} /> Clear All
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>

            {/* Status Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loan Status</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'active', 'closed', 'overdue'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: filterStatus === s ? (s === 'all' ? '#6366f1' : STATUS_COLORS[s] || '#6366f1') : 'var(--bg-primary)',
                      color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Rate Range */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interest Rate (%)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterMinRate}
                  onChange={e => setFilterMinRate(e.target.value)}
                  className="input"
                  style={{ width: 80, fontSize: 12, height: 34, padding: '0 10px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filterMaxRate}
                  onChange={e => setFilterMaxRate(e.target.value)}
                  className="input"
                  style={{ width: 80, fontSize: 12, height: 34, padding: '0 10px' }}
                />
                {uniqueRates.length > 0 && (
                  <select className="select" value="" onChange={e => { if (e.target.value) { setFilterMinRate(e.target.value); setFilterMaxRate(e.target.value); }}} style={{ fontSize: 12, height: 34, flex: 1 }}>
                    <option value="">Quick pick</option>
                    {uniqueRates.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Issue Date Range */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Date From</label>
              <NepaliDateInput value={filterIssueDateFrom} onChange={ad => setFilterIssueDateFrom(ad)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Date To</label>
              <NepaliDateInput value={filterIssueDateTo} onChange={ad => setFilterIssueDateTo(ad)} />
            </div>

            {/* Principal Range */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Principal (Rs.)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterMinPrincipal}
                  onChange={e => setFilterMinPrincipal(e.target.value)}
                  className="input"
                  style={{ width: 100, fontSize: 12, height: 34, padding: '0 10px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filterMaxPrincipal}
                  onChange={e => setFilterMaxPrincipal(e.target.value)}
                  className="input"
                  style={{ width: 100, fontSize: 12, height: 34, padding: '0 10px' }}
                />
              </div>
            </div>

            {/* Overdue Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Has Overdue Installments</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'yes', 'no'].map(v => (
                  <button
                    key={v}
                    onClick={() => setFilterHasOverdue(v as 'all' | 'yes' | 'no')}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: filterHasOverdue === v ? (v === 'yes' ? '#ef4444' : v === 'no' ? '#22c55e' : '#6366f1') : 'var(--bg-primary)',
                      color: filterHasOverdue === v ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, marginBottom: 28 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div style={{ background: 'rgba(99,102,241,0.1)', padding: 10, borderRadius: 10, color: '#6366f1' }}><CreditCard size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Total Disbursed</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(kpis.totalDisbursed)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{kpis.total} loans</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 10, color: '#ef4444' }}><Wallet size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Outstanding Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{formatCurrency(kpis.totalOutstanding)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{kpis.active} active</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', padding: 10, borderRadius: 10, color: '#22c55e' }}><CheckCircle2 size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Total Repaid</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(kpis.totalRepaid)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{kpis.closed} closed</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ background: 'rgba(245,158,11,0.1)', padding: 10, borderRadius: 10, color: '#f59e0b' }}><TrendingUp size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Interest Collected</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(kpis.interestCollected)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>From paid installments</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ background: 'rgba(139,92,246,0.1)', padding: 10, borderRadius: 10, color: '#8b5cf6' }}><BarChart2 size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Recovery Rate</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>
              {kpis.totalDisbursed > 0 ? ((kpis.totalRepaid / kpis.totalDisbursed) * 100).toFixed(1) : '0.0'}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Repaid vs disbursed</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 10, color: '#ef4444' }}><Clock size={22} /></div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Overdue Installments</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{filteredOverdue.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pending past due date</div>
          </div>
        </div>
      </div>

      {/* ── ROW 1: Trend + Status ── */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* Monthly Disbursement Trend */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Disbursement & Repayment Trend</div>
              <div className="card-subtitle">Monthly principal disbursed vs repaid</div>
            </div>
          </div>
          {loanTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={loanTrend}>
                <defs>
                  <linearGradient id="lGradD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lGradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="disbursed" stroke="#6366f1" fill="url(#lGradD)" strokeWidth={2} name="Disbursed" />
                <Area type="monotone" dataKey="repaid" stroke="#22c55e" fill="url(#lGradR)" strokeWidth={2} name="Repaid" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No disbursement data</div>}
        </div>

        {/* Portfolio Status Pie */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Portfolio Status</div>
              <div className="card-subtitle">Active, closed & overdue breakdown</div>
            </div>
          </div>
          {statusDist.some(d => d.value > 0) ? (
            <div>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" nameKey="name">
                    {statusDist.map((d, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[d.name] || COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
                {statusDist.map((d, idx) => (
                  <div key={idx} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: STATUS_COLORS[d.name] || COLORS[idx % COLORS.length] }}>{d.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{d.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty-state">No portfolio data</div>}
        </div>
      </div>

      {/* ── ROW 2: Interest Rate + Principal Distribution ── */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* Interest Rate Distribution */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Interest Rate Distribution</div>
              <div className="card-subtitle">Number of loans by interest rate</div>
            </div>
          </div>
          {rateDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rateDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rate" stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Loans" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No rate data</div>}
        </div>

        {/* Principal Range Distribution */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Loan Size Distribution</div>
              <div className="card-subtitle">Number of loans by principal amount range</div>
            </div>
          </div>
          {principalRangeDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={principalRangeDist}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={4} dataKey="count" nameKey="range"
                >
                  {principalRangeDist.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No loan size data</div>}
        </div>
      </div>

      {/* ── ROW 3: Top Borrowers + Overdue ── */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* Top Borrowers */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Top Borrowers</div>
              <div className="card-subtitle">By principal amount disbursed</div>
            </div>
            <Link href="/dashboard/loans" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>View All →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Borrower</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Principal</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Rate</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {topBorrowers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No loans found</td></tr>
                ) : topBorrowers.map((b, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {b.hasOverdue && <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />}
                        {b.name}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-primary)' }}>Rs. {b.principal.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: b.outstanding > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                      Rs. {b.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 12 }}>
                      <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{b.rate}%</span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 6, fontWeight: 600,
                        background: b.status === 'closed' ? 'rgba(34,197,94,0.12)' : b.status === 'overdue' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                        color: b.status === 'closed' ? '#22c55e' : b.status === 'overdue' ? '#ef4444' : '#6366f1',
                      }}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Installments */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="card-title">Overdue Installments</div>
              <div className="card-subtitle">Pending installments past due date</div>
            </div>
            {filteredOverdue.length > 0 && (
              <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                {filteredOverdue.length} overdue
              </span>
            )}
          </div>
          {filteredOverdue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#22c55e' }}>
              <CheckCircle2 size={36} style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>All installments on track!</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>No overdue installments found</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Borrower</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverdue.map((o, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>{o.borrower}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>Rs. {o.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                        <span style={{
                          background: o.daysOverdue > 30 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: o.daysOverdue > 30 ? '#ef4444' : '#f59e0b',
                          padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        }}>{o.daysOverdue}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
