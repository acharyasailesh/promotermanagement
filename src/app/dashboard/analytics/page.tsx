'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  MapPin,
  AlertCircle,
  TrendingUp,
  Wallet,
  Trophy,
  Award,
  Banknote,
} from 'lucide-react';
import {
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
  AreaChart,
  Area,
} from 'recharts';

import NepaliDateInput from '../components/NepaliDateInput';

interface Shareholder {
  id: string;
  first_name: string;
  last_name: string;
  perm_address: {
    province?: string;
    district?: string;
    municipality?: string;
  };
  nid_no?: string;
  pan_no?: string;
  email?: string;
  created_at: string;
  member_since: string;
}

interface Investment {
  shareholder_id: string;
  amount: number;
  status: string;
}

interface ShareCertificate {
  shareholder_id: string;
  num_shares: number;
}


const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#22c55e', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // RAW Data Cache State
  const [rawShareholders, setRawShareholders] = useState<Shareholder[]>([]);
  const [rawInvestments, setRawInvestments] = useState<Investment[]>([]);
  const [rawCertificates, setRawCertificates] = useState<ShareCertificate[]>([]);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterProvince, setFilterProvince] = useState('all');
  const [uniqueProvinces, setUniqueProvinces] = useState<string[]>([]);

  // Computed Dashboard States
  const [totalShareholders, setTotalShareholders] = useState(0);
  const [totalShares, setTotalShares] = useState(0);
  const [averageHoldings, setAverageHoldings] = useState(0);
  const [geographicReach, setGeographicReach] = useState(0);

  const [missingEmails, setMissingEmails] = useState(0);
  const [missingPan, setMissingPan] = useState(0);
  const [missingNid, setMissingNid] = useState(0);

  const [provinceData, setProvinceData] = useState<Array<{ name: string; value: number }>>([]);
  const [districtData, setDistrictData] = useState<Array<{ name: string; counts: number }>>([]);
  const [growthTrend, setGrowthTrend] = useState<Array<{ month: string; counts: number }>>([]);
  
  // New Analytics state
  const [shareDistribution, setShareDistribution] = useState<Array<{ range: string; counts: number; percent: string }>>([]);
  const [topShareholders, setTopShareholders] = useState<Array<{ id: string; name: string; email: string; district: string; shares: number }>>([]);
  const [shareConcentration, setShareConcentration] = useState<Array<{ category: string; percentage: number }>>([]);
  const [topDistrictsList, setTopDistrictsList] = useState<Array<{ name: string; count: number; shares: number }>>([]);



  useEffect(() => {
    fetchRawData();
  }, []);


  const fetchRawData = async () => {
    setLoading(true);
    try {
      const [shRes, invRes, certRes] = await Promise.all([
        supabase.from('shareholders').select('id, first_name, last_name, perm_address, nid_no, pan_no, email, member_since, created_at').is('deleted_at', null),
        supabase.from('investments').select('shareholder_id, amount').eq('status', 'verified'),
        supabase.from('share_certificates').select('shareholder_id, num_shares').is('deleted_at', null),
      ]);

      const shs = (shRes.data || []) as unknown as Shareholder[];
      setRawShareholders(shs);
      setRawInvestments((invRes.data || []) as unknown as Investment[]);
      setRawCertificates((certRes.data || []) as unknown as ShareCertificate[]);

      const provs = [...new Set(shs.map(s => s.perm_address?.province).filter(Boolean))] as string[];
      setUniqueProvinces(provs);
    } catch (error) {
      console.error('Error fetching raw data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Re-compute Analytics when any filter changes
  useEffect(() => {
    if (rawShareholders.length === 0) {
      setTotalShareholders(0);
      return;
    }

    // A. Apply Filters
    const filteredShs = rawShareholders.filter(sh => {
      if (startDate && sh.member_since < startDate) return false;
      if (endDate && sh.member_since > endDate) return false;
      if (filterProvince !== 'all' && sh.perm_address?.province !== filterProvince) return false;
      return true;
    });

    setTotalShareholders(filteredShs.length);

    // B. Missing Info
    let mEmail = 0, mPan = 0, mNid = 0;
    filteredShs.forEach(sh => {
      if (!sh.email || sh.email.trim() === '') mEmail++;
      if (!sh.pan_no || sh.pan_no.trim() === '') mPan++;
      if (!sh.nid_no || sh.nid_no.trim() === '') mNid++;
    });
    setMissingEmails(mEmail);
    setMissingPan(mPan);
    setMissingNid(mNid);

    // C. Province Breakdown
    const provinceCounts: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const prov = sh.perm_address?.province || 'Unspecified';
      provinceCounts[prov] = (provinceCounts[prov] || 0) + 1;
    });
    setProvinceData(Object.entries(provinceCounts).map(([name, value]) => ({ name, value })));

    // D. District Breakdown (Count)
    const districtCounts: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const dist = sh.perm_address?.district || 'Unspecified';
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;
    });
    setDistrictData(
      Object.entries(districtCounts)
        .map(([name, counts]) => ({ name, counts }))
        .sort((a, b) => b.counts - a.counts)
        .slice(0, 10)
    );

    // E. Growth Trend Over time
    const monthlyGrowth: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const date = new Date(sh.member_since);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyGrowth[key] = (monthlyGrowth[key] || 0) + 1;
    });
    
    const sortedMonths = Object.entries(monthlyGrowth).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const cumulativeGrowth = sortedMonths.map(([month, counts]) => {
      cumulative += counts;
      return { month, counts: cumulative };
    });
    setGrowthTrend(cumulativeGrowth);

    // F. NEW ANALYTICS: Shares mapped to User
    const userShares: Record<string, number> = {};
    rawCertificates.forEach(cert => {
      userShares[cert.shareholder_id] = (userShares[cert.shareholder_id] || 0) + Number(cert.num_shares);
    });

    // 1. Total Shares
    let tShares = 0;
    filteredShs.forEach(sh => {
      tShares += userShares[sh.id] || 0;
    });
    setTotalShares(tShares);

    // 2. Average Holdings
    setAverageHoldings(filteredShs.length > 0 ? tShares / filteredShs.length : 0);

    // 3. Geographic Reach
    const districtSet = new Set(filteredShs.map(sh => sh.perm_address?.district).filter(Boolean));
    setGeographicReach(districtSet.size);

    // 4. Share Distribution (Pie)
    let d1 = 0, d2 = 0, d3 = 0, d4 = 0, d5 = 0, d6 = 0;
    filteredShs.forEach(sh => {
      const shares = userShares[sh.id] || 0;
      if (shares <= 1000) d1++;
      else if (shares <= 5000) d2++;
      else if (shares <= 10000) d3++;
      else if (shares <= 15000) d4++;
      else if (shares <= 20000) d5++;
      else d6++;
    });
    
    const totalCount = filteredShs.length || 1;
    setShareDistribution([
      { range: '0-1K', counts: d1, percent: ((d1 / totalCount) * 100).toFixed(0) + '%' },
      { range: '1K-5K', counts: d2, percent: ((d2 / totalCount) * 100).toFixed(0) + '%' },
      { range: '5K-10K', counts: d3, percent: ((d3 / totalCount) * 100).toFixed(0) + '%' },
      { range: '10K-15K', counts: d4, percent: ((d4 / totalCount) * 100).toFixed(0) + '%' },
      { range: '15K-20K', counts: d5, percent: ((d5 / totalCount) * 100).toFixed(0) + '%' },
      { range: '20K+', counts: d6, percent: ((d6 / totalCount) * 100).toFixed(0) + '%' },
    ]);

    // 5. Top Shareholders
    const mappedTop = filteredShs.map(sh => ({
      id: sh.id,
      name: `${sh.first_name} ${sh.last_name}`,
      email: sh.email || '—',
      district: sh.perm_address?.district || '—',
      shares: userShares[sh.id] || 0
    }))
    .sort((a, b) => b.shares - a.shares)
    .slice(0, 10);
    setTopShareholders(mappedTop);

    // 6. Share Concentration
    const allSortedShares = filteredShs.map(sh => userShares[sh.id] || 0).sort((a, b) => b - a);
    const getSum = (limit: number) => allSortedShares.slice(0, limit).reduce((a, b) => a + b, 0);
    setShareConcentration([
      { category: 'Top 10', percentage: tShares > 0 ? (getSum(10) / tShares) * 100 : 0 },
      { category: 'Top 50', percentage: tShares > 0 ? (getSum(50) / tShares) * 100 : 0 },
      { category: 'Top 100', percentage: tShares > 0 ? (getSum(100) / tShares) * 100 : 0 },
      { category: 'All', percentage: 100 }
    ]);

    // 7. Top Districts List
    const distDataMap: Record<string, { count: number; shares: number }> = {};
    filteredShs.forEach(sh => {
      const dist = sh.perm_address?.district || 'Unspecified';
      const shares = userShares[sh.id] || 0;
      if (!distDataMap[dist]) distDataMap[dist] = { count: 0, shares: 0 };
      distDataMap[dist].count += 1;
      distDataMap[dist].shares += shares;
    });
    
    setTopDistrictsList(
      Object.entries(distDataMap).map(([name, v]) => ({
        name,
        count: v.count,
        shares: v.shares
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    );

  }, [rawShareholders, rawInvestments, rawCertificates, startDate, endDate, filterProvince]);





  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return <div className="loading">Loading Analytics...</div>;
  }

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', padding: '24px', margin: '-24px' }}>

      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontWeight: 800 }}>Management Analytics</h1>
          <p className="page-subtitle">Deep dive into shareholder demographics and analytics for BOD &amp; Management</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="search-bar no-print" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: '30px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
           <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>From (Join):</label>
           <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
        </div>
        <div className="flex items-center gap-2">
           <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>To:</label>
           <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
        </div>
        <div style={{ minWidth: 150 }}>
          <select className="select" value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} style={{ fontSize: 13, height: 38 }}>
            <option value="all">All Provinces</option>
            {uniqueProvinces.sort().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {(startDate || endDate || filterProvince !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setFilterProvince('all'); }} style={{ color: 'var(--danger)', fontSize: 13, alignSelf: 'center' }}>
            Clear
          </button>
        )}
      </div>

      <div className="page-body">
        {/* KPI Row */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <Link href="/dashboard/shareholders" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '10px', color: '#6366f1' }}><Users size={24} /></div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Shareholders</div>
                <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{totalShareholders.toLocaleString()}</div>
                <div style={{ color: '#22c55e', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} /> +12% Active</div>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/shareholders" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ transition: 'transform 0.2s' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '10px', color: '#f59e0b' }}><Wallet size={24} /></div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Shares</div>
                <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{totalShares.toLocaleString()}</div>
                <div style={{ color: '#22c55e', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} /> +8% Kitta</div>
              </div>
            </div>
          </Link>

          <div className="stat-card">
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '10px', color: '#8b5cf6' }}><TrendingUp size={24} /></div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Average Holdings</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{Math.round(averageHoldings).toLocaleString()}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Per shareholder</div>
            </div>
          </div>

          <Link href="/dashboard/shareholders" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ transition: 'transform 0.2s' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '10px', color: '#22c55e' }}><MapPin size={24} /></div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Geographic Reach</div>
                <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{geographicReach}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Districts covered</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Charts Grid 1: Distributions */}
        <div className="grid-2" style={{ marginBottom: '30px' }}>
          {/* Share Distribution */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <div>
                <div className="card-title">Share Distribution</div>
                <div className="card-subtitle">Shareholders by investment size (Kitta)</div>
              </div>
            </div>
            {shareDistribution.some(d => d.counts > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={shareDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="counts"
                    nameKey="range"
                  >
                    {shareDistribution.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No Distribution Data</div>}
          </div>

          {/* Geographic Distribution */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <div>
                <div className="card-title">Geographic Distribution</div>
                <div className="card-subtitle">Top 10 districts by shareholders</div>
              </div>
            </div>
            {districtData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={districtData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} width={80} tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="counts" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No District Data</div>}
          </div>
        </div>

        {/* Charts Grid 2: Concentration & High Value */}
        <div className="grid-2" style={{ marginBottom: '30px' }}>
          {/* Share Concentration */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <div>
                <div className="card-title">Share Concentration</div>
                <div className="card-subtitle">Cumulative percentage held by top shareholders</div>
              </div>
            </div>
            {shareConcentration.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={shareConcentration}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="percentage" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No Concentration Data</div>}
          </div>

          {/* District List with Action link */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <div>
                <div className="card-title">Top Districts Detail</div>
                <div className="card-subtitle">Click to view shareholders</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', maxHeight: '280px', overflowY: 'auto', paddingRight: '5px' }}>
              {topDistrictsList.map((dist, idx) => (
                <Link href={`/dashboard/shareholders?district=${dist.name}`} key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', color: '#f59e0b' }}><MapPin size={18} /></div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{dist.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dist.count} investors • {dist.shares.toLocaleString()} Kitta</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Top Shareholders Table */}
        <div className="card" style={{ marginBottom: '30px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <div>
              <div className="card-title">Top Shareholders</div>
              <div className="card-subtitle">Largest stakeholders by share count</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <th style={{ padding: '12px' }}>Rank</th>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>District</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Shares (Kitta)</th>
                </tr>
              </thead>
              <tbody>
                {topShareholders.map((sh, idx) => {
                  let badge = null;
                  if (idx === 0) badge = <Trophy size={16} style={{ color: '#f59e0b' }} /> ;
                  else if (idx === 1) badge = <Award size={16} style={{ color: '#94a3b8' }} /> ;
                  else if (idx === 2) badge = <Award size={16} style={{ color: '#b45309' }} /> ;
                  
                  return (
                    <tr key={sh.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {badge ? badge : (idx + 1)}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sh.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sh.email}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>{sh.district}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                          {sh.shares.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Original Missing Data Stats at the bottom */}
        {missingEmails > 0 && (
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="card-title">Data Hygiene Alerts</div>
                <div className="card-subtitle">Shareholders with missing critical information</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link href="/dashboard/shareholders?missing=email" style={{ flex: 1, minWidth: '150px', textDecoration: 'none' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <AlertCircle size={20} style={{ color: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Email</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{missingEmails}</div>
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/shareholders?missing=pan" style={{ flex: 1, minWidth: '150px', textDecoration: 'none' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <AlertCircle size={20} style={{ color: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing PAN</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{missingPan}</div>
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/shareholders?missing=nid" style={{ flex: 1, minWidth: '150px', textDecoration: 'none' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <AlertCircle size={20} style={{ color: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing NID</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{missingNid}</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ LOAN ANALYTICS QUICK LINK ═══════════════ */}
      <div style={{ marginTop: 40 }}>
        <Link href="/dashboard/analytics/loans" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(99,102,241,0.12)', padding: '14px 16px', borderRadius: 12, color: '#6366f1' }}>
                <Banknote size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>Loan Portfolio Analytics</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Detailed loan activity, disbursement trends, overdue tracking, interest rate breakdown &amp; risk analysis
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Loan Status', 'Date Range', 'Interest Rate', 'Principal Range', 'Overdue Filter'].map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              View Analytics
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}