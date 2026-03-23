'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle, Clock, AlertTriangle, ShieldCheck,
  X, Search, UserCheck, FileText, Upload, Plus, Vote,
  ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Minus, BarChart2, ListOrdered
} from 'lucide-react';
import { processImage } from '@/lib/utils/imageProcess';

// ---------- TYPES ----------
interface Settings { share_face_value: number; agm_proxy_unit: number; }
interface Shareholder { id: string; first_name: string; last_name: string; email: string | null; phone_number: string | null; total_shares: number; }
interface AGMSession { id: string; title: string; meeting_date: string; is_active: boolean; }
interface AGMAttendance { id: string; shareholder_id: string; status: 'physical'; }
interface AGMProxy { id: string; giver_shareholder_id: string; proxy_holder_id: string | null; proxy_holder_name: string | null; allocated_shares: number; proxy_document_url: string | null; }
interface AGMResolution { id: string; agm_id: string; title: string; description: string | null; resolution_type: 'ordinary' | 'special'; order_num: number; status: 'pending' | 'voting' | 'passed' | 'failed' | 'withdrawn'; }
interface AGMVote { id: string; resolution_id: string; voter_shareholder_id: string | null; voter_name: string | null; vote_kittas: number; vote: 'for' | 'against' | 'abstain'; vote_mode: 'physical' | 'proxy'; }

type TabType = 'attendance' | 'resolutions';

export default function AGMPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('attendance');

  // Data
  const [settings, setSettings] = useState<Settings>({ share_face_value: 100, agm_proxy_unit: 10000 });
  const [activeSession, setActiveSession] = useState<AGMSession | null>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [attendance, setAttendance] = useState<AGMAttendance[]>([]);
  const [proxies, setProxies] = useState<AGMProxy[]>([]);
  const [resolutions, setResolutions] = useState<AGMResolution[]>([]);
  const [votes, setVotes] = useState<AGMVote[]>([]);

  // Search/UI
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'present' | 'absent'>('all');

  // Proxy Modal
  const [proxyModalOpen, setProxyModalOpen] = useState(false);
  const [proxyGiver, setProxyGiver] = useState<Shareholder | null>(null);
  const [proxyFormData, setProxyFormData] = useState({ receiverId: '', receiverName: '', allocatedShares: 0, attachment: null as File | null });

  // Session Modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<{ id: string; name: string }[]>([]);
  const [sessionForm, setSessionForm] = useState({ title: '', meeting_date: new Date().toISOString().split('T')[0], fiscal_year_id: '' });

  // Resolution Modal
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({ title: '', description: '', resolution_type: 'ordinary' as 'ordinary' | 'special' });

  // Vote Modal
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [activeResolution, setActiveResolution] = useState<AGMResolution | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: setts } = await supabase.from('company_settings').select('*').limit(1).single();
      setSettings({ share_face_value: Number(setts?.share_face_value || 100), agm_proxy_unit: Number(setts?.agm_proxy_unit || 10000) });

      const { data: sess } = await supabase.from('agm_sessions').select('*').eq('is_active', true).maybeSingle();
      setActiveSession(sess);

      const [shRes, certRes] = await Promise.all([
        supabase.from('shareholders').select('id, first_name, last_name, email, phone_number').is('deleted_at', null),
        supabase.from('share_certificates').select('shareholder_id, num_shares').eq('status', 'active').is('deleted_at', null)
      ]);
      const shareMap: Record<string, number> = {};
      (certRes.data || []).forEach(c => { shareMap[c.shareholder_id] = (shareMap[c.shareholder_id] || 0) + Number(c.num_shares); });
      setShareholders((shRes.data || []).map(s => ({ ...s, total_shares: shareMap[s.id] || 0 })).filter(s => s.total_shares > 0));

      if (sess) {
        const [attRes, proxRes, resRes] = await Promise.all([
          supabase.from('agm_attendance').select('*').eq('agm_id', sess.id),
          supabase.from('agm_proxies').select('*').eq('agm_id', sess.id),
          supabase.from('agm_resolutions').select('*').eq('agm_id', sess.id).order('order_num')
        ]);
        setAttendance(attRes.data || []);
        setProxies((proxRes.data || []).map(p => ({ ...p, allocated_shares: Number(p.allocated_shares) })));
        setResolutions(resRes.data || []);

        if (resRes.data && resRes.data.length > 0) {
          const resIds = resRes.data.map(r => r.id);
          const { data: voteData } = await supabase.from('agm_votes').select('*').in('resolution_id', resIds);
          setVotes((voteData || []).map(v => ({ ...v, vote_kittas: Number(v.vote_kittas) })));
        }
      }

      if (!sess) {
        const { data: fys } = await supabase.from('fiscal_years').select('id, name').order('start_date', { ascending: false });
        const fyList = fys || [];
        setFiscalYears(fyList);
        if (fyList.length > 0) setSessionForm(prev => ({ ...prev, fiscal_year_id: fyList[0].id }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load AGM data');
    } finally { setLoading(false); }
  };

  // ---------- CALCULATIONS ----------
  const stats = useMemo(() => {
    let companyTotalKittas = 0;
    shareholders.forEach(s => companyTotalKittas += s.total_shares);

    const physicalIds = new Set(attendance.map(a => a.shareholder_id));
    let physicalKittas = 0;
    shareholders.forEach(s => { if (physicalIds.has(s.id)) physicalKittas += s.total_shares; });

    let proxyKittas = 0;
    proxies.forEach(p => { proxyKittas += p.allocated_shares; });

    const totalPresentKittas = physicalKittas + proxyKittas;
    const quorumPercentage = companyTotalKittas > 0 ? (totalPresentKittas / companyTotalKittas) * 100 : 0;

    return {
      companyTotalKittas, companyTotalCapital: companyTotalKittas * settings.share_face_value,
      physicalKittas, proxyKittas, totalPresentKittas,
      totalPresentCapital: totalPresentKittas * settings.share_face_value,
      quorumPercentage, isGoodToGo: quorumPercentage >= 51,
      totalAttendees: physicalIds.size, totalProxies: proxies.length
    };
  }, [shareholders, attendance, proxies, settings]);

  // Resolution vote tally
  const getResolutionTally = (resId: string) => {
    const rv = votes.filter(v => v.resolution_id === resId);
    const forKittas = rv.filter(v => v.vote === 'for').reduce((s, v) => s + v.vote_kittas, 0);
    const againstKittas = rv.filter(v => v.vote === 'against').reduce((s, v) => s + v.vote_kittas, 0);
    const abstainKittas = rv.filter(v => v.vote === 'abstain').reduce((s, v) => s + v.vote_kittas, 0);
    const totalKittas = forKittas + againstKittas + abstainKittas;
    return { forKittas, againstKittas, abstainKittas, totalKittas, voterCount: rv.length };
  };

  // Who can vote (physical attendees + unique proxy holders)
  const voterList = useMemo(() => {
    const list: { id: string; name: string; kittas: number; mode: 'physical' | 'proxy'; shareholderId: string | null }[] = [];
    const physicalIds = new Set(attendance.map(a => a.shareholder_id));

    shareholders.forEach(sh => {
      if (physicalIds.has(sh.id)) {
        list.push({ id: `ph_${sh.id}`, name: `${sh.first_name} ${sh.last_name}`, kittas: sh.total_shares, mode: 'physical', shareholderId: sh.id });
      }
    });

    // Group proxies by holder
    const holderMap: Record<string, { name: string; kittas: number; shareholderId: string | null }> = {};
    proxies.forEach(p => {
      const key = p.proxy_holder_id || p.proxy_holder_name || 'Unknown';
      if (!holderMap[key]) holderMap[key] = { name: p.proxy_holder_name || 'Unknown Holder', kittas: 0, shareholderId: p.proxy_holder_id };
      holderMap[key].kittas += p.allocated_shares;
    });
    Object.entries(holderMap).forEach(([key, val]) => {
      list.push({ id: `px_${key}`, name: `${val.name} (Proxy)`, kittas: val.kittas, mode: 'proxy', shareholderId: val.shareholderId });
    });

    return list;
  }, [attendance, proxies, shareholders]);

  // ---------- ACTIONS ----------
  const handleCreateSession = async () => {
    if (!sessionForm.title || !sessionForm.fiscal_year_id || !sessionForm.meeting_date) return toast.error('Please fill all fields');
    try {
      setLoading(true);
      await supabase.from('agm_sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await supabase.from('agm_sessions').insert({ ...sessionForm, is_active: true });
      if (error) throw error;
      toast.success('New AGM Session started!');
      setSessionModalOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message || 'Failed'); } finally { setLoading(false); }
  };

  const togglePhysicalPresence = async (shareholderId: string, isPresent: boolean) => {
    if (!activeSession) return toast.error('No active AGM session');
    try {
      if (isPresent) {
        const gaveProxy = proxies.some(p => p.giver_shareholder_id === shareholderId);
        if (gaveProxy) {
          if (!window.confirm('This shareholder gave a proxy. Marking present will remove their proxy. Continue?')) return;
          await supabase.from('agm_proxies').delete().eq('agm_id', activeSession.id).eq('giver_shareholder_id', shareholderId);
          setProxies(prev => prev.filter(p => p.giver_shareholder_id !== shareholderId));
        }
        const { data, error } = await supabase.from('agm_attendance').insert({ agm_id: activeSession.id, shareholder_id: shareholderId, status: 'physical' }).select().single();
        if (error) throw error;
        setAttendance(prev => [...prev, data]);
        toast.success('Marked as physical attendee');
      } else {
        const { error } = await supabase.from('agm_attendance').delete().eq('agm_id', activeSession.id).eq('shareholder_id', shareholderId);
        if (error) throw error;
        setAttendance(prev => prev.filter(a => a.shareholder_id !== shareholderId));
        toast.success('Removed physical attendance');
      }
    } catch (err: any) { toast.error('Failed to update attendance'); }
  };

  const uploadFile = async (f: File, folder: string) => {
    const ext = f.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${ext}`;
    let fileToUpload: File | Blob = f;
    if (f.type.startsWith('image/')) fileToUpload = await processImage(f);
    const { error } = await supabase.storage.from('company_documents').upload(fileName, fileToUpload, { upsert: true });
    if (error) throw error;
    return supabase.storage.from('company_documents').getPublicUrl(fileName).data.publicUrl;
  };

  const submitProxy = async () => {
    if (!activeSession || !proxyGiver) return;
    if (proxyFormData.allocatedShares <= 0 || proxyFormData.allocatedShares > proxyGiver.total_shares) return toast.error('Invalid shares');
    if (!proxyFormData.receiverId && !proxyFormData.receiverName.trim()) return toast.error('Must provide a proxy holder name');
    try {
      let docUrl = null;
      if (proxyFormData.attachment) { toast.loading('Uploading...', { id: 'pu' }); docUrl = await uploadFile(proxyFormData.attachment, 'proxies'); toast.dismiss('pu'); }
      const currentlyGiven = proxies.filter(p => p.giver_shareholder_id === proxyGiver.id).reduce((s, p) => s + p.allocated_shares, 0);
      if (currentlyGiven + Number(proxyFormData.allocatedShares) > proxyGiver.total_shares) return toast.error(`Only ${proxyGiver.total_shares - currentlyGiven} shares available`);
      const wasPhysical = attendance.some(a => a.shareholder_id === proxyGiver.id);
      if (wasPhysical) { await supabase.from('agm_attendance').delete().eq('agm_id', activeSession.id).eq('shareholder_id', proxyGiver.id); setAttendance(prev => prev.filter(a => a.shareholder_id !== proxyGiver.id)); }
      const { data, error } = await supabase.from('agm_proxies').insert({ agm_id: activeSession.id, giver_shareholder_id: proxyGiver.id, proxy_holder_id: proxyFormData.receiverId || null, proxy_holder_name: proxyFormData.receiverName || null, allocated_shares: Number(proxyFormData.allocatedShares), proxy_document_url: docUrl }).select().single();
      if (error) throw error;
      setProxies(prev => [...prev, { ...data, allocated_shares: Number(data.allocated_shares) }]);
      setProxyModalOpen(false); setProxyGiver(null);
      toast.success('Proxy assigned');
    } catch (err: any) { toast.dismiss('pu'); toast.error(err.message || 'Failed'); }
  };

  const deleteProxy = async (proxyId: string) => {
    if (!window.confirm('Remove this proxy?')) return;
    const { error } = await supabase.from('agm_proxies').delete().eq('id', proxyId);
    if (error) return toast.error('Failed');
    setProxies(prev => prev.filter(p => p.id !== proxyId));
    toast.success('Proxy removed');
  };

  const handleAddResolution = async () => {
    if (!activeSession || !resolutionForm.title.trim()) return toast.error('Title required');
    const nextOrder = resolutions.length + 1;
    const { data, error } = await supabase.from('agm_resolutions').insert({ agm_id: activeSession.id, title: resolutionForm.title, description: resolutionForm.description || null, resolution_type: resolutionForm.resolution_type, order_num: nextOrder, status: 'pending' }).select().single();
    if (error) return toast.error(error.message);
    setResolutions(prev => [...prev, data]);
    setResolutionForm({ title: '', description: '', resolution_type: 'ordinary' });
    setResolutionModalOpen(false);
    toast.success('Resolution added');
  };

  const updateResolutionStatus = async (res: AGMResolution, newStatus: AGMResolution['status']) => {
    const { error } = await supabase.from('agm_resolutions').update({ status: newStatus }).eq('id', res.id);
    if (error) return toast.error(error.message);
    setResolutions(prev => prev.map(r => r.id === res.id ? { ...r, status: newStatus } : r));
    toast.success(`Resolution ${newStatus}`);
  };

  const castVote = async (resolution: AGMResolution, voterId: string, voterName: string, voterShId: string | null, kittas: number, voteMode: 'physical' | 'proxy', vote: 'for' | 'against' | 'abstain') => {
    // Remove existing vote for this voter on this resolution
    const existingVote = votes.find(v => v.resolution_id === resolution.id && (voterShId ? v.voter_shareholder_id === voterShId : v.voter_name === voterName));
    if (existingVote) {
      await supabase.from('agm_votes').delete().eq('id', existingVote.id);
      setVotes(prev => prev.filter(v => v.id !== existingVote.id));
    }

    const { data, error } = await supabase.from('agm_votes').insert({
      resolution_id: resolution.id, agm_id: activeSession!.id,
      voter_shareholder_id: voterShId,
      voter_name: voterName,
      vote_kittas: kittas,
      vote,
      vote_mode: voteMode
    }).select().single();
    if (error) return toast.error(error.message);
    setVotes(prev => [...prev, { ...data, vote_kittas: Number(data.vote_kittas) }]);
  };

  const finalizeResolution = async (res: AGMResolution) => {
    const tally = getResolutionTally(res.id);
    const passed = tally.forKittas > tally.againstKittas;
    await updateResolutionStatus(res, passed ? 'passed' : 'failed');
  };

  const deleteResolution = async (resId: string) => {
    if (!window.confirm('Delete this resolution?')) return;
    await supabase.from('agm_resolutions').delete().eq('id', resId);
    setResolutions(prev => prev.filter(r => r.id !== resId));
    setVotes(prev => prev.filter(v => v.resolution_id !== resId));
    toast.success('Deleted');
  };

  // ---------- HELPERS ----------
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const getInitials = (f: string, l: string) => `${(f || '')[0]}${(l || '')[0]}`.toUpperCase();

  const filteredList = shareholders.filter(sh => {
    const fullName = `${sh.first_name} ${sh.last_name}`.toLowerCase();
    if (searchTerm && !fullName.includes(searchTerm.toLowerCase()) && !sh.phone_number?.includes(searchTerm)) return false;
    const isPhysical = attendance.some(a => a.shareholder_id === sh.id);
    const hasProxy = proxies.some(p => p.giver_shareholder_id === sh.id);
    if (viewMode === 'present' && !isPhysical && !hasProxy) return false;
    if (viewMode === 'absent' && (isPhysical || hasProxy)) return false;
    return true;
  });

  if (loading) return <div className="loading">Loading AGM Data...</div>;

  const statusColor: Record<string, string> = { pending: '#f59e0b', voting: '#6366f1', passed: '#22c55e', failed: '#ef4444', withdrawn: '#6b7280' };
  const statusBg: Record<string, string> = { pending: 'rgba(245,158,11,0.1)', voting: 'rgba(99,102,241,0.1)', passed: 'rgba(34,197,94,0.1)', failed: 'rgba(239,68,68,0.1)', withdrawn: 'rgba(107,114,128,0.1)' };

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', padding: '24px', margin: '-24px' }}>
      {/* HEADER */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="page-title" style={{ fontWeight: 800 }}>AGM Voting &amp; Quorum</h1>
            <p className="page-subtitle">Track attendance, proxy weightage, and conduct resolution voting.</p>
          </div>
          {!activeSession ? (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <AlertTriangle size={18} /> No Active AGM Session
            </div>
          ) : (
            <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <Clock size={18} /> {activeSession.title}
              <span style={{ fontWeight: 400, opacity: 0.8 }}>({new Date(activeSession.meeting_date).toLocaleDateString()})</span>
            </div>
          )}
        </div>
      </div>

      {!activeSession ? (
        <div className="empty-state" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3>No AGM Currently Running</h3>
          <p style={{ maxWidth: 400, margin: '0 auto 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>Start an active session to begin tracking attendance and quorum requirements.</p>
          <button className="btn btn-primary" onClick={() => setSessionModalOpen(true)}>Start New AGM Session</button>
        </div>
      ) : (
        <div>
          {/* QUORUM METER */}
          <div className="card" style={{ marginBottom: 24, background: stats.isGoodToGo ? 'linear-gradient(145deg, var(--bg-card) 0%, rgba(34,197,94,0.05) 100%)' : 'var(--bg-card)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'center', padding: '4px 0' }}>
              <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={stats.isGoodToGo ? '#22c55e' : '#f59e0b'} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(Math.min(stats.quorumPercentage, 100) / 100) * 314} 314`} transform="rotate(-90 60 60)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: stats.isGoodToGo ? '#22c55e' : 'var(--text-primary)' }}>{stats.quorumPercentage.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>QUORUM</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: stats.isGoodToGo ? '#22c55e' : 'var(--text-primary)' }}>
                  {stats.isGoodToGo ? <ShieldCheck size={24} /> : <AlertTriangle size={24} color="#f59e0b" />}
                  {stats.isGoodToGo ? 'Quorum Reached — AGM Valid' : 'Awaiting 51% Quorum'}
                </h2>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Physical', value: fmt(stats.physicalKittas), sub: `${stats.totalAttendees} people`, color: '#6366f1' },
                    { label: 'Proxy', value: fmt(stats.proxyKittas), sub: `${stats.totalProxies} forms`, color: '#8b5cf6' },
                    { label: 'Total Present', value: fmt(stats.totalPresentKittas), sub: `${fmt(stats.totalPresentCapital)} Rs`, color: '#f59e0b' },
                    { label: 'Company Total', value: fmt(stats.companyTotalKittas), sub: `${fmt(stats.companyTotalCapital)} Rs`, color: 'var(--text-secondary)' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value} <span style={{ fontSize: 10, fontWeight: 400 }}>kittas</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
            {([
              { key: 'attendance', label: 'Attendance & Proxies', icon: <UserCheck size={16} /> },
              { key: 'resolutions', label: `Resolutions & Voting (${resolutions.length})`, icon: <Vote size={16} /> }
            ] as { key: TabType; label: string; icon: React.ReactNode }[]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderBottom: `2px solid ${activeTab === tab.key ? 'var(--primary)' : 'transparent'}`, color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: -2, transition: '0.2s'
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ========== ATTENDANCE TAB ========== */}
          {activeTab === 'attendance' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Attendance Tracker</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Mark physical presence or assign proxy</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '8px', fontSize: 13, outline: 'none', color: 'var(--text-primary)', width: 160 }} />
                  </div>
                  <select className="select" value={viewMode} onChange={e => setViewMode(e.target.value as any)} style={{ fontSize: 12, padding: '6px 10px' }}>
                    <option value="all">All</option>
                    <option value="present">Present / Proxy</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 550 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1 }}>
                    <tr style={{ color: 'var(--text-secondary)', fontSize: 12, borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'left' }}>Shareholder</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'left' }}>Kittas</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map(sh => {
                      const isPhysical = attendance.some(a => a.shareholder_id === sh.id);
                      const userProxies = proxies.filter(p => p.giver_shareholder_id === sh.id);
                      const hasProxy = userProxies.length > 0;
                      const allocatedProxyShares = userProxies.reduce((s, p) => s + p.allocated_shares, 0);
                      const remainingShares = sh.total_shares - allocatedProxyShares;
                      return (
                        <tr key={sh.id} style={{ borderBottom: '1px solid var(--border)', background: (isPhysical || hasProxy) ? 'rgba(34,197,94,0.02)' : 'transparent' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{getInitials(sh.first_name, sh.last_name)}</div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{sh.first_name} {sh.last_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sh.phone_number || sh.email || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(sh.total_shares)}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(sh.total_shares * settings.share_face_value)} Rs</div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            {isPhysical ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                <CheckCircle size={12} /> Physical
                              </span>
                            ) : hasProxy ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {userProxies.map(up => (
                                  <div key={up.id} style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <FileText size={12} /> Proxy: {up.proxy_holder_name || '(Holder)'}
                                    <span style={{ opacity: 0.7 }}>({fmt(up.allocated_shares)}kt)</span>
                                    <button onClick={() => deleteProxy(up.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 1, display: 'flex' }}><X size={11} /></button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Absent</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                              {(!hasProxy || (remainingShares > 0 && !isPhysical)) && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: isPhysical ? '#22c55e' : 'var(--text-secondary)' }}>Present</span>
                                  <input type="checkbox" checked={isPhysical} onChange={e => togglePhysicalPresence(sh.id, e.target.checked)} style={{ display: 'none' }} />
                                  <div style={{ width: 40, height: 22, background: isPhysical ? '#22c55e' : 'var(--border)', borderRadius: 11, position: 'relative', transition: '0.3s' }}>
                                    <div style={{ position: 'absolute', top: 2, left: isPhysical ? 20 : 2, width: 18, height: 18, background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                  </div>
                                </label>
                              )}
                              {!isPhysical && remainingShares > 0 && (
                                <button className="btn btn-outline btn-sm" onClick={() => { setProxyGiver(sh); setProxyFormData({ receiverId: '', receiverName: '', allocatedShares: sh.total_shares, attachment: null }); setProxyModalOpen(true); }}>
                                  Appoint Proxy
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredList.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No shareholders found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== RESOLUTIONS TAB ========== */}
          {activeTab === 'resolutions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700 }}>AGM Resolutions</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Add resolutions and record weighted votes from attendees and proxy holders.</p>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setResolutionModalOpen(true)}>
                  <Plus size={16} /> Add Resolution
                </button>
              </div>

              {resolutions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-secondary)' }}>
                  <ListOrdered size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p>No resolutions added yet. Add agenda items to start voting.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {resolutions.map(res => {
                    const tally = getResolutionTally(res.id);
                    const forPct = tally.totalKittas > 0 ? (tally.forKittas / tally.totalKittas) * 100 : 0;
                    const againstPct = tally.totalKittas > 0 ? (tally.againstKittas / tally.totalKittas) * 100 : 0;
                    const isFinalized = res.status === 'passed' || res.status === 'failed';

                    return (
                      <div key={res.id} className="card" style={{ borderLeft: `4px solid ${statusColor[res.status]}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>#{res.order_num}</span>
                              <span style={{ background: res.resolution_type === 'special' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', color: res.resolution_type === 'special' ? '#ef4444' : '#6366f1', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                {res.resolution_type}
                              </span>
                              <span style={{ background: statusBg[res.status], color: statusColor[res.status], padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                {res.status}
                              </span>
                            </div>
                            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{res.title}</h3>
                            {res.description && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{res.description}</p>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!isFinalized && (
                              <>
                                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                  onClick={() => { setActiveResolution(res); setVoteModalOpen(true); }}>
                                  <Vote size={14} /> Cast Votes
                                </button>
                                {tally.voterCount > 0 && (
                                  <button className="btn btn-outline btn-sm" onClick={() => finalizeResolution(res)}>Finalize</button>
                                )}
                              </>
                            )}
                            <button onClick={() => deleteResolution(res.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                          </div>
                        </div>

                        {/* Vote Tally */}
                        {tally.voterCount > 0 && (
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                              {[
                                { label: 'For', kittas: tally.forKittas, pct: forPct, color: '#22c55e', icon: <ThumbsUp size={14} /> },
                                { label: 'Against', kittas: tally.againstKittas, pct: againstPct, color: '#ef4444', icon: <ThumbsDown size={14} /> },
                                { label: 'Abstain', kittas: tally.abstainKittas, pct: 100 - forPct - againstPct, color: '#6b7280', icon: <Minus size={14} /> },
                              ].map(item => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                  <span style={{ color: item.color }}>{item.icon}</span>
                                  <span style={{ fontWeight: 700, color: item.color }}>{item.label}:</span>
                                  <span style={{ fontWeight: 600 }}>{fmt(item.kittas)} kt</span>
                                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({item.pct.toFixed(1)}%)</span>
                                </div>
                              ))}
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{tally.voterCount} voter(s) recorded</div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${forPct}%`, background: '#22c55e', transition: '0.5s' }} />
                              <div style={{ width: `${againstPct}%`, background: '#ef4444', transition: '0.5s' }} />
                              <div style={{ flex: 1, background: '#6b7280', opacity: 0.4 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== PROXY MODAL ========== */}
      {proxyModalOpen && proxyGiver && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Appoint Proxy</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setProxyModalOpen(false); setProxyGiver(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Proxy Giver:</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{proxyGiver.first_name} {proxyGiver.last_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Total: {fmt(proxyGiver.total_shares)} kittas</div>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">Allocated Shares *</label>
                <input type="number" className="input" min={1} max={proxyGiver.total_shares} value={proxyFormData.allocatedShares || ''} onChange={e => setProxyFormData({ ...proxyFormData, allocatedShares: Number(e.target.value) })} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">Proxy Holder Name *</label>
                <input type="text" className="input" placeholder="Name of representative..." value={proxyFormData.receiverName} onChange={e => setProxyFormData({ ...proxyFormData, receiverName: e.target.value, receiverId: '' })} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="label">Proxy Document (Optional)</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', border: '2px dashed var(--border)', borderRadius: 10, cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <Upload size={22} style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 13 }}>{proxyFormData.attachment ? proxyFormData.attachment.name : 'Click to upload'}</div>
                  <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={e => setProxyFormData({ ...proxyFormData, attachment: e.target.files?.[0] || null })} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitProxy}>Submit Proxy</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setProxyModalOpen(false); setProxyGiver(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== SESSION MODAL ========== */}
      {sessionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Start AGM Session</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSessionModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">AGM Title</label>
                <input type="text" className="input" placeholder="e.g. 5th Annual General Meeting" value={sessionForm.title} onChange={e => setSessionForm({ ...sessionForm, title: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">Fiscal Year</label>
                <select className="select" value={sessionForm.fiscal_year_id} onChange={e => setSessionForm({ ...sessionForm, fiscal_year_id: e.target.value })}>
                  <option value="">Select Fiscal Year</option>
                  {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="label">Meeting Date</label>
                <input type="date" className="input" value={sessionForm.meeting_date} onChange={e => setSessionForm({ ...sessionForm, meeting_date: e.target.value })} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreateSession} disabled={loading}>{loading ? 'Starting...' : 'Activate Session'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD RESOLUTION MODAL ========== */}
      {resolutionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Resolution</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setResolutionModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">Resolution Title *</label>
                <input type="text" className="input" placeholder="e.g. Approval of Annual Accounts" value={resolutionForm.title} onChange={e => setResolutionForm({ ...resolutionForm, title: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="label">Description (Optional)</label>
                <textarea className="input" style={{ minHeight: 80, resize: 'vertical' }} placeholder="Brief description of the resolution..." value={resolutionForm.description} onChange={e => setResolutionForm({ ...resolutionForm, description: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="label">Resolution Type</label>
                <select className="select" value={resolutionForm.resolution_type} onChange={e => setResolutionForm({ ...resolutionForm, resolution_type: e.target.value as any })}>
                  <option value="ordinary">Ordinary Resolution (Simple Majority)</option>
                  <option value="special">Special Resolution (75% Majority)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddResolution}>Add Resolution</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setResolutionModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== VOTE MODAL ========== */}
      {voteModalOpen && activeResolution && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Cast Votes: {activeResolution.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Record vote from each attendee and proxy holder</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setVoteModalOpen(false); setActiveResolution(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {voterList.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No attendees or proxy holders yet. Mark attendance first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {voterList.map(voter => {
                    const existingVote = votes.find(v => v.resolution_id === activeResolution.id && (voter.shareholderId ? v.voter_shareholder_id === voter.shareholderId : v.voter_name === voter.name));
                    return (
                      <div key={voter.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: `1px solid ${existingVote ? (existingVote.vote === 'for' ? 'rgba(34,197,94,0.3)' : existingVote.vote === 'against' ? 'rgba(239,68,68,0.3)' : 'rgba(107,114,128,0.3)') : 'var(--border)'}` }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{voter.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmt(voter.kittas)} kittas · {voter.mode === 'physical' ? '🟢 Physical' : '🟣 Proxy'}
                            {existingVote && <span style={{ marginLeft: 8, fontWeight: 700, color: existingVote.vote === 'for' ? '#22c55e' : existingVote.vote === 'against' ? '#ef4444' : '#6b7280', textTransform: 'uppercase' }}>✓ {existingVote.vote}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['for', 'against', 'abstain'] as const).map(v => (
                            <button key={v} onClick={() => castVote(activeResolution, voter.id, voter.name, voter.shareholderId, voter.kittas, voter.mode, v)}
                              style={{
                                padding: '6px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                                background: existingVote?.vote === v ? (v === 'for' ? 'rgba(34,197,94,0.15)' : v === 'against' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)') : 'transparent',
                                borderColor: v === 'for' ? '#22c55e' : v === 'against' ? '#ef4444' : '#6b7280',
                                color: v === 'for' ? '#22c55e' : v === 'against' ? '#ef4444' : '#6b7280',
                              }}>
                              {v === 'for' ? '✓ For' : v === 'against' ? '✗ Against' : '— Abstain'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { finalizeResolution(activeResolution); setVoteModalOpen(false); setActiveResolution(null); }}>
                Finalize & Record Result
              </button>
              <button className="btn btn-outline" onClick={() => { setVoteModalOpen(false); setActiveResolution(null); }}>Done (Keep Pending)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
