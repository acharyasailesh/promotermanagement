'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  TrendingUp,
  Receipt,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Wallet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface DashboardStats {
  totalShareholders: number;
  totalShareCollection: number;
  totalExpenses: number;
  totalNetReturns: number;
  bankBalance: number;
  pettyCashBalance: number;
  activeCertificates: number;
  kycPending: number;
  kycVerified: number;
  recentShareCollections: Array<{
    id: string;
    amount: number;
    investment_date: string;
    shareholder_name: string;
    status: string;
  }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#22c55e', '#f59e0b'];

export default function DashboardPage() {
  const supabase = createClient();
  const [company, setCompany] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalShareholders: 0,
    totalShareCollection: 0,
    totalExpenses: 0,
    totalNetReturns: 0,
    bankBalance: 0,
    pettyCashBalance: 0,
    activeCertificates: 0,
    kycPending: 0,
    kycVerified: 0,
    recentShareCollections: [],
  });
  const [loading, setLoading] = useState(true);
  const [investmentTrend, setInvestmentTrend] = useState<Array<{ month: string; amount: number }>>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (settings) setCompany(settings);

      // Total shareholders
      const { count: shareholderCount } = await supabase
        .from('shareholders')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('is_active', true);

      // KYC stats
      const { count: kycPending } = await supabase
        .from('shareholders')
        .select('*', { count: 'exact', head: true })
        .eq('kyc_status', 'pending')
        .is('deleted_at', null);

      const { count: kycVerified } = await supabase
        .from('shareholders')
        .select('*', { count: 'exact', head: true })
        .eq('kyc_status', 'verified')
        .is('deleted_at', null);

      // Total investment (Bank only)
      const { data: investmentData } = await supabase
        .from('investments')
        .select('amount')
        .eq('status', 'verified')
        .eq('payment_method', 'bank');

      const totalBankShareCollection = investmentData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

      // Total investment (Global for collections card)
      const { data: globalInvData } = await supabase
        .from('investments')
        .select('amount')
        .eq('status', 'verified');
      
      const totalShareCollection = globalInvData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

      // Total expenses
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount, payment_method')
        .is('deleted_at', null);

      const totalExpenses = expenseData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalBankExpenses = expenseData?.filter(e => e.payment_method === 'bank').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Total ROI (Net Return)
      const { data: returnData } = await supabase
        .from('investment_returns')
        .select('net_amount, payment_method')
        .is('deleted_at', null);

      const totalNetReturns = returnData?.reduce((sum, r) => sum + Number(r.net_amount), 0) || 0;
      const totalBankNetReturns = returnData?.filter(r => r.payment_method === 'bank').reduce((sum, r) => sum + Number(r.net_amount), 0) || 0;

      // Total Company Investments (Outward)
      const { data: outwardInvData } = await supabase
        .from('company_investments')
        .select('principal_amount')
        .is('deleted_at', null);
      
      const totalOutwardInvestments = outwardInvData?.reduce((sum, i) => sum + Number(i.principal_amount), 0) || 0;

      // Total Initial Balances from all banks
      const { data: bankInitData } = await supabase
        .from('company_banks')
        .select('initial_balance');
      
      const totalInitialBalances = bankInitData?.reduce((sum, b) => sum + Number(b.initial_balance), 0) || 0;

      // Bank Balance Calculation
      // (Total Initial + Share Collections (Bank) + ROI Net (Bank)) - (Expenses (Bank) + Company Investments)
      const bankBalance = (totalInitialBalances + (totalBankShareCollection || 0) + (totalBankNetReturns || 0)) - ((totalBankExpenses || 0) + (totalOutwardInvestments || 0));

      // Petty Cash Balance
      const { data: pettyData } = await supabase.from('petty_cash_ledger').select('amount, type');
      const pettyCashBalance = (pettyData || []).reduce((acc, e) => {
        return e.type === 'inflow' ? acc + Number(e.amount) : acc - Number(e.amount);
      }, 0);

      // Active certificates
      const { count: certCount } = await supabase
        .from('share_certificates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Recent investments
      const { data: recentInvData } = await supabase
        .from('investments')
        .select(`
          id, amount, investment_date, status,
          shareholders!inner(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const recentShareCollections = (recentInvData || []).map((inv: Record<string, unknown>) => {
        const sh = inv.shareholders as Record<string, unknown>;
        return {
          id: inv.id as string,
          amount: Number(inv.amount),
          investment_date: inv.investment_date as string,
          shareholder_name: `${sh.first_name} ${sh.last_name}`,
          status: inv.status as string,
        };
      });

      // Investment trend (mock months for now - will use real data when available)
      const { data: trendData } = await supabase
        .from('investments')
        .select('amount, investment_date')
        .eq('status', 'verified')
        .order('investment_date', { ascending: true });

      const monthlyTrend: Record<string, number> = {};
      (trendData || []).forEach((inv: Record<string, unknown>) => {
        const date = new Date(inv.investment_date as string);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTrend[key] = (monthlyTrend[key] || 0) + Number(inv.amount);
      });

      setInvestmentTrend(
        Object.entries(monthlyTrend).map(([month, amount]) => ({ month, amount }))
      );

      // Expense by category
      const { data: expCatData } = await supabase
        .from('expenses')
        .select('amount, expense_categories!inner(name)')
        .is('deleted_at', null);

      const categoryTotals: Record<string, number> = {};
      (expCatData || []).forEach((e: Record<string, unknown>) => {
        const cat = e.expense_categories as Record<string, unknown>;
        const name = cat.name as string;
        categoryTotals[name] = (categoryTotals[name] || 0) + Number(e.amount);
      });

      setExpenseByCategory(
        Object.entries(categoryTotals).map(([name, value]) => ({ name, value }))
      );

      setStats({
        totalShareholders: shareholderCount || 0,
        totalShareCollection,
        totalExpenses,
        totalNetReturns,
        bankBalance,
        pettyCashBalance,
        activeCertificates: certCount || 0,
        kycPending: kycPending || 0,
        kycVerified: kycVerified || 0,
        recentShareCollections,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome to {company?.company_name || 'Global Bihani Investment'}</p>
          </div>
        </div>
        <div className="page-body">
          <div className="stats-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: 120, height: 28 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  const kycData = [
    { name: 'Verified', value: stats.kycVerified },
    { name: 'Pending', value: stats.kycPending },
    { name: 'Total', value: stats.totalShareholders - stats.kycVerified - stats.kycPending },
  ].filter(d => d.value > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{company?.company_name || 'Global Bihani Investment'} — {company?.address || 'Pokhara, Newroad'}</p>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="stats-grid">
          <Link href="/dashboard/shareholders" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-icon purple">
              <Users size={22} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Shareholders</div>
              <div className="stat-value">{stats.totalShareholders}</div>
              <div className="stat-change positive">
                <ArrowUpRight size={14} />
                {stats.kycVerified} verified
              </div>
            </div>
          </Link>

          <Link href="/dashboard/investments" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-icon green">
              <TrendingUp size={22} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Share Collection</div>
              <div className="stat-value" style={{ fontSize: 22 }}>
                {formatCurrency(stats.totalShareCollection)}
              </div>
              <div className="stat-change positive">
                <ArrowUpRight size={14} />
                Verified only
              </div>
            </div>
          </Link>

          <Link href="/dashboard/banks" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-icon blue">
              <Landmark size={22} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Bank Balance</div>
              <div className="stat-value" style={{ fontSize: 22 }}>
                {formatCurrency(stats.bankBalance)}
              </div>
              <div className="stat-change positive">
                <ArrowUpRight size={14} />
                Available liquid funds
              </div>
            </div>
          </Link>

          <Link href="/dashboard/expenses" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-icon red">
              <Receipt size={22} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Expenses</div>
              <div className="stat-value" style={{ fontSize: 22 }}>
                {formatCurrency(stats.totalExpenses)}
              </div>
              <div className="stat-change negative">
                <ArrowDownRight size={14} />
                Operational costs
              </div>
            </div>
          </Link>

          <Link href="/dashboard/petty-cash" className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Wallet size={22} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Cash Balance</div>
              <div className="stat-value" style={{ fontSize: 22 }}>
                {formatCurrency(stats.pettyCashBalance)}
              </div>
              <div className="stat-change positive">
                <ArrowUpRight size={14} />
                Available cash on hand
              </div>
            </div>
          </Link>
        </div>

        {/* Charts Row */}
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {/* Investment Trend */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Share Collection Trend</div>
                <div className="card-subtitle">Monthly share collection inflow</div>
              </div>
              <Link href="/dashboard/investments" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {investmentTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={investmentTrend}>
                  <defs>
                    <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                    formatter={(value: unknown) => [formatCurrency(Number(value)), 'Share Collection']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#investGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <TrendingUp size={40} />
                <h3>No share collection data yet</h3>
                <p>Charts will appear once collections are recorded.</p>
              </div>
            )}
          </div>

          {/* Expense by Category */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Expenses by Category</div>
                <div className="card-subtitle">Operational cost breakdown</div>
              </div>
              <Link href="/dashboard/expenses" className="btn btn-ghost btn-sm">Manage</Link>
            </div>
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseByCategory.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                    formatter={(value: unknown) => [formatCurrency(Number(value))]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#a0a0b2' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <Receipt size={40} />
                <h3>No expense data yet</h3>
                <p>Charts will appear once expenses are recorded.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Investments & KYC */}
        <div className="grid-2">
          {/* Recent Investments Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Share Collections</div>
                <div className="card-subtitle">Latest 5 entries</div>
              </div>
              <Link href="/dashboard/investments" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {stats.recentShareCollections.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Shareholder</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentShareCollections.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {inv.shareholder_name}
                        </td>
                        <td>{formatCurrency(inv.amount)}</td>
                        <td>{inv.investment_date}</td>
                        <td>
                          <span
                            className={`badge ${
                              inv.status === 'verified'
                                ? 'badge-success'
                                : inv.status === 'cancelled'
                                ? 'badge-danger'
                                : 'badge-warning'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <TrendingUp size={40} />
                <h3>No share collections yet</h3>
                <p>Record your first share collection to see it here.</p>
              </div>
            )}
          </div>

          {/* KYC Status Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">KYC Compliance</div>
                <div className="card-subtitle">Shareholder verification status</div>
              </div>
              <Link href="/dashboard/shareholders" className="btn btn-ghost btn-sm">Manage</Link>
            </div>
            {kycData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={kycData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {kycData.map((_, index) => (
                      <Cell key={index} fill={['#22c55e', '#f59e0b', '#6b6b80'][index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <Users size={40} />
                <h3>No KYC data</h3>
                <p>Add shareholders to see compliance stats.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
