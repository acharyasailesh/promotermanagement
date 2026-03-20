'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, CheckCircle, Clock, XCircle, X, Upload, Eye, FileText, Image, Info, Download, Printer, Landmark } from 'lucide-react';
import { adToBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface Investment {
  id: string;
  shareholder_id: string;
  investment_date: string;
  amount: number;
  payment_method: string;
  bank_name: string | null;
  bank_account_no: string | null;
  proof_url: string | null;
  payment_slip_url: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  shareholders: { first_name: string; last_name: string; phone_number: string | null };
  company_bank_id: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
  is_active: boolean;
}

interface ShareholderOption {
  id: string;
  member_id: number;
  first_name: string;
  last_name: string;
}

export default function InvestmentsPage() {
  const supabase = createClient();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal states for cancel/delete
  const [cancellingInv, setCancellingInv] = useState<Investment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deletingInv, setDeletingInv] = useState<Investment | null>(null);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  const [form, setForm] = useState({
    shareholder_id: '',
    investment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'bank',
    company_bank_id: '',
    bank_name: '',
    bank_account_no: '',
    remarks: '',
    cheque_number: '',
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('investments')
      .select('*, shareholders!inner(first_name, last_name, phone_number)')
      .is('deleted_at', null)
      .order('investment_date', { ascending: false });

    if (error) {
      toast.error('Failed to load investments');
    } else {
      setInvestments((data || []) as Investment[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (investments.length > 0 && !startDate && !endDate) {
      setStartDate(investments[0].investment_date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [investments, startDate, endDate]);

  const fetchBanks = useCallback(async () => {
    const { data } = await supabase.from('company_banks').select('*').eq('is_active', true);
    setBanks((data || []) as CompanyBank[]);
  }, [supabase]);

  const fetchShareholders = useCallback(async () => {
    const { data } = await supabase
      .from('shareholders')
      .select('id, first_name, last_name, created_at')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    const members = (data || []).map((sh, idx) => ({ ...sh, member_id: idx + 1 }));
    setShareholders(members as ShareholderOption[]);
  }, [supabase]);

  useEffect(() => {
    fetchInvestments();
    fetchShareholders();
    fetchBanks();
  }, [fetchInvestments, fetchShareholders, fetchBanks]);

  useEffect(() => {
    const fetchSelectedBalance = async () => {
      if (form.payment_method === 'cash') {
        setFetchingBalance(true);
        const bal = await getPettyCashBalance(supabase);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else if (form.company_bank_id && form.payment_method === 'bank') {
        setFetchingBalance(true);
        const bal = await getBankBalance(supabase, form.company_bank_id);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else {
        setCurrentSelectedBalance(null);
      }
    };
    fetchSelectedBalance();
  }, [form.company_bank_id, form.payment_method, supabase]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const uploadFile = async (file: File, bucket: string) => {
    try {
      const processedFile = await processImage(file);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(filePath, finalFile);
      if (error) return null;
      
      const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      return data?.signedUrl || null;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let proofUrl = editing?.proof_url || null;
    let slipUrl = editing?.payment_slip_url || null;
    let chequeUrl = editing?.cheque_image_url || null;

    if (proofFile) {
      proofUrl = await uploadFile(proofFile, 'investment-proofs');
      if (!proofUrl) { toast.error('Failed to upload receipt'); setSaving(false); return; }
    }
    if (slipFile) {
      slipUrl = await uploadFile(slipFile, 'investment-proofs');
      if (!slipUrl) { toast.error('Failed to upload payment slip'); setSaving(false); return; }
    }
    if (chequeFile) {
      chequeUrl = await uploadFile(chequeFile, 'investment-proofs');
      if (!chequeUrl) { toast.error('Failed to upload cheque receipt'); setSaving(false); return; }
    }

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      shareholder_id: form.shareholder_id,
      investment_date: form.investment_date,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      bank_name: (form.payment_method === 'bank') ? (banks.find(b => b.id === form.company_bank_id)?.bank_name || null) : null,
      bank_account_no: (form.payment_method === 'bank') ? (banks.find(b => b.id === form.company_bank_id)?.account_number || null) : null,
      company_bank_id: (form.payment_method === 'bank') ? (form.company_bank_id || null) : null,
      cheque_number: null,
      cheque_image_url: (form.payment_method === 'bank') ? chequeUrl : null,
      proof_url: proofUrl,
      payment_slip_url: slipUrl,
      remarks: form.remarks || null,
      created_by: user?.id,
    };

    if (editing) {
      const { data: updated, error } = await supabase.from('investments').update(payload).eq('id', editing.id).select().single();
      if (error) toast.error('Failed to update'); else {
        toast.success('Share collection updated');
        // Collection increases petty cash if verified
        if (updated && updated.status === 'verified' && updated.payment_method === 'cash') {
          await supabase.from('petty_cash_ledger').upsert({
            reference_id: updated.id,
            date: updated.investment_date,
            type: 'inflow',
            source: 'collection',
            amount: updated.amount,
            description: `Verified collection from shareholder ID: ${updated.shareholder_id}`,
            created_by: user?.id
          }, { onConflict: 'reference_id' });
        } else {
          await supabase.from('petty_cash_ledger').delete().eq('reference_id', editing.id);
        }
      }
    } else {
      const { data, error } = await supabase.from('investments').insert(payload).select().single();
      if (error) toast.error('Failed to create'); else {
        toast.success('Share collection recorded');
        // Collections usually start as pending, so we don't sync to ledger here (ledger sync is on verification)
      }
    }

    setSaving(false);
    setShowModal(false);
    fetchInvestments();
  };

  const handleVerify = async (inv: Investment) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('investments')
      .update({ status: 'verified', verified_by: user?.id, verified_at: new Date().toISOString() })
      .eq('id', inv.id);
    if (error) {
      toast.error('Failed');
    } else {
      toast.success('Share collection verified');
      // If payment was cash, push to ledger now that it's verified
      if (inv.payment_method === 'cash') {
        await supabase.from('petty_cash_ledger').upsert({
          reference_id: inv.id,
          date: inv.investment_date,
          type: 'inflow',
          source: 'collection',
          amount: inv.amount,
          description: `Verified collection from shareholder ID: ${inv.shareholder_id}`,
          created_by: user?.id
        }, { onConflict: 'reference_id' });
      }
      fetchInvestments();
    }
  };

  // Cancel investment
  const openCancel = (inv: Investment) => {
    setCancellingInv(inv);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!cancellingInv) return;
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    setSaving(true);
    
    // Append cancel reason to existing remarks
    const existingRemarks = cancellingInv.remarks ? cancellingInv.remarks + '\n\n' : '';
    const newRemarks = `${existingRemarks}[CANCELLED] Reason: ${cancelReason}`;

    const { error } = await supabase.from('investments').update({ 
      status: 'cancelled',
      remarks: newRemarks 
    }).eq('id', cancellingInv.id);

    if (error) {
      toast.error('Failed to cancel');
    } else {
      toast.success('Share collection cancelled');
      // Remove from petty cash ledger if it was there
      await supabase.from('petty_cash_ledger').delete().eq('reference_id', cancellingInv.id);
      fetchInvestments();
      setCancellingInv(null);
    }
    setSaving(false);
  };

  // Delete investment (super_admin only)
  const openDelete = (inv: Investment) => {
    setDeletingInv(inv);
  };

  const confirmDelete = async () => {
    if (!deletingInv) return;
    setSaving(true);
    const { error } = await supabase.from('investments').update({ deleted_at: new Date().toISOString() }).eq('id', deletingInv.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Share collection deleted');
      // Double check ledger deletion
      await supabase.from('petty_cash_ledger').delete().eq('reference_id', deletingInv.id);
      fetchInvestments();
      setDeletingInv(null);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ shareholder_id: '', investment_date: new Date().toISOString().split('T')[0], amount: '', payment_method: 'bank', company_bank_id: '', bank_name: '', bank_account_no: '', remarks: '', cheque_number: '' });
    setProofFile(null);
    setSlipFile(null);
    setChequeFile(null);
    setProofPreview(null);
    setSlipPreview(null);
    setChequePreview(null);
    setShowModal(true);
  };

  const openEdit = (inv: Investment) => {
    setEditing(inv);
    setForm({
      shareholder_id: inv.shareholder_id,
      investment_date: inv.investment_date,
      amount: String(inv.amount),
      payment_method: inv.payment_method,
      company_bank_id: inv.company_bank_id || '',
      bank_name: inv.bank_name || '',
      bank_account_no: inv.bank_account_no || '',
      remarks: inv.remarks || '',
      cheque_number: inv.cheque_number || '',
    });
    setProofFile(null);
    setSlipFile(null);
    setChequeFile(null);
    setProofPreview(null);
    setSlipPreview(null);
    setChequePreview(null);
    setShowModal(true);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProofFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleSlipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSlipFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setSlipPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setSlipPreview(null);
    }
  };

  const handleChequeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setChequeFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setChequePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setChequePreview(null);
    }
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(url) || url.includes('/object/sign/') || url.includes('/object/public/');

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const statusBadge = (s: string) => s === 'verified' ? 'badge-success' : s === 'cancelled' ? 'badge-danger' : 'badge-warning';
  const statusIcon = (s: string) => s === 'verified' ? <CheckCircle size={14} /> : s === 'cancelled' ? <XCircle size={14} /> : <Clock size={14} />;

  const filtered = investments.filter(t => {
    const d = t.investment_date;
    const matchesSearch = (t.shareholders?.first_name || '').toLowerCase().includes(search.toLowerCase()) || 
                         (t.shareholders?.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (t.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
                         (t.bank_name || '').toLowerCase().includes(search.toLowerCase());
    
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Share Collection</h1>
          <p className="page-subtitle">Track and manage share collection from shareholders</p>
          <div className="print-period">
            Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary no-print" onClick={openCreate} id="add-investment-btn">
            <Plus size={16} /> Record Share Collection
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center">
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search collections..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">From:</label>
               <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">To:</label>
               <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
            </div>
            {(startDate || endDate || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}>Clear</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <h3>No share collections recorded</h3>
            <p>Start tracking shareholder share collections here.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}><Plus size={16} /> Record Share Collection</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th>Date (BS)</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Proof</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {inv.shareholders.first_name} {inv.shareholders.last_name}
                    </td>
                    <td>{adToBs(inv.investment_date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(inv.amount)}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{inv.payment_method}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {inv.proof_url ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(inv.proof_url!)} style={{ color: 'var(--primary-light)' }}>
                            <Eye size={14} /> Receipt
                          </button>
                        ) : null}
                        {inv.payment_slip_url ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(inv.payment_slip_url!)} style={{ color: 'var(--info, #38bdf8)' }}>
                            <Eye size={14} /> Slip
                          </button>
                        ) : null}
                        {inv.cheque_image_url ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(inv.cheque_image_url!)} style={{ color: 'var(--warning, #f59e0b)' }}>
                            <Eye size={14} /> Cheque
                          </button>
                        ) : null}
                        {!inv.proof_url && !inv.payment_slip_url && !inv.cheque_image_url && '—'}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${statusBadge(inv.status)} flex items-center gap-2`}>
                          {statusIcon(inv.status)} {inv.status}
                        </span>
                        {inv.remarks && (
                          <div title={inv.remarks} style={{ cursor: 'help', color: 'var(--text-muted)' }}>
                            <Info size={16} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        {inv.status === 'pending' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleVerify(inv)} style={{ color: 'var(--success)' }}>
                            <CheckCircle size={14} /> Verify
                          </button>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(inv)} title="Edit"><Edit2 size={16} /></button>
                        {inv.status !== 'cancelled' && (
                          <button className="btn btn-ghost btn-icon" onClick={() => openCancel(inv)} style={{ color: 'var(--warning, #f59e0b)' }} title="Cancel">
                            <XCircle size={16} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={() => openDelete(inv)} style={{ color: 'var(--danger)' }} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Share Collection' : 'Record New Share Collection'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Shareholder <span className="required">*</span></label>
                    <select className="select" value={form.shareholder_id} onChange={(e) => handleInputChange('shareholder_id', e.target.value)} required>
                      <option value="">Select shareholder...</option>
                      {shareholders.map((sh) => (
                        <option key={sh.id} value={sh.id}>#{sh.member_id} - {sh.first_name} {sh.last_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="input-group">
                    <label>Collection Date (BS) <span className="required">*</span></label>
                    <NepaliDateInput 
                      value={form.investment_date} 
                      onChange={(adDate) => handleInputChange('investment_date', adDate)} 
                      required 
                      align="right"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Amount (Rs.) <span className="required">*</span></span>
                      {currentSelectedBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-light)' }}>
                          Bank Bal: Rs. {currentSelectedBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking balance...</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.amount} onChange={(e) => handleInputChange('amount', e.target.value)} required placeholder="0.00" />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Payment Method <span className="required">*</span></label>
                    <select className="select" value={form.payment_method} onChange={(e) => handleInputChange('payment_method', e.target.value)}>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>

                  {(form.payment_method === 'bank' || form.payment_method === 'check') && (
                    <>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Select Company Bank <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.company_bank_id} 
                          onChange={(e) => {
                            const bankId = e.target.value;
                            const bank = banks.find(b => b.id === bankId);
                            setForm(p => ({ 
                              ...p, 
                              company_bank_id: bankId, 
                              bank_name: bank?.bank_name || '', 
                              bank_account_no: bank?.account_number || '' 
                            }));
                          }}
                          required
                        >
                          <option value="">Select bank account...</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Bank Name</label>
                        <input className="input" value={form.bank_name} readOnly style={{ opacity: 0.7, background: 'var(--bg-secondary)' }} placeholder="Bank name" />
                      </div>
                      <div className="input-group">
                        <label>Account Number</label>
                        <input className="input" value={form.bank_account_no} readOnly style={{ opacity: 0.7, background: 'var(--bg-secondary)' }} placeholder="Account no." />
                      </div>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Payment Proof Image (Cheque/Slip)</label>
                        <input type="file" accept="image/*,.pdf" onChange={handleChequeFileChange} style={{ fontSize: 13 }} />
                        {chequePreview && (
                          <div className="preview-box" onClick={() => setLightboxUrl(chequePreview)} style={{ marginTop: 8 }}>
                            <img src={chequePreview} alt="Cheque preview" style={{ maxHeight: 100 }} />
                            <span className="preview-label">New Cheque</span>
                          </div>
                        )}
                        {!chequePreview && editing?.cheque_image_url && (
                          <div className="preview-box" onClick={() => setLightboxUrl(editing.cheque_image_url!)} style={{ marginTop: 8 }}>
                            {isImageUrl(editing.cheque_image_url!) ? (
                              <img src={editing.cheque_image_url} alt="Current cheque" style={{ maxHeight: 100 }} />
                            ) : (
                              <div className="preview-file-placeholder"><FileText size={16} /> <span>View PDF</span></div>
                            )}
                            <span className="preview-label current">Current Cheque</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Remarks</label>
                    <textarea 
                      className="textarea" 
                      value={form.remarks} 
                      onChange={(e) => handleInputChange('remarks', e.target.value)} 
                      placeholder="Additional notes..."
                      style={{ minHeight: 60 }}
                    />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0 12px 0' }} />
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Attachments</h4>
                  </div>

                  <div className="input-group">
                    <label>{form.payment_method === 'cash' ? 'Cash Receipt' : 'Bank Deposit Screenshot'}</label>
                    <input type="file" accept="image/*,.pdf" onChange={handleProofFileChange} style={{ fontSize: 13 }} />
                    {proofPreview && (
                      <div className="preview-box" onClick={() => setLightboxUrl(proofPreview)}>
                        <img src={proofPreview} alt="Receipt preview" />
                        <span className="preview-label">New</span>
                      </div>
                    )}
                    {!proofPreview && editing?.proof_url && (
                      <div className="preview-box" onClick={() => setLightboxUrl(editing.proof_url!)}>
                        {isImageUrl(editing.proof_url!) ? (
                          <img src={editing.proof_url} alt="Current receipt" />
                        ) : (
                          <div className="preview-file-placeholder"><FileText size={16} /> <span>View PDF</span></div>
                        )}
                        <span className="preview-label current">Current</span>
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Payment Slip (Optional)</label>
                    <input type="file" accept="image/*,.pdf" onChange={handleSlipFileChange} style={{ fontSize: 13 }} />
                    {slipPreview && (
                      <div className="preview-box" onClick={() => setLightboxUrl(slipPreview)}>
                        <img src={slipPreview} alt="Slip preview" />
                        <span className="preview-label">New</span>
                      </div>
                    )}
                    {!slipPreview && editing?.payment_slip_url && (
                      <div className="preview-box" onClick={() => setLightboxUrl(editing.payment_slip_url!)}>
                        {isImageUrl(editing.payment_slip_url!) ? (
                          <img src={editing.payment_slip_url} alt="Current slip" />
                        ) : (
                          <div className="preview-file-placeholder"><FileText size={16} /> <span>View PDF</span></div>
                        )}
                        <span className="preview-label current">Current</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', fontSize: 20,
            }}
          >
            <X size={22} />
          </button>
          {isImageUrl(lightboxUrl) || lightboxUrl.startsWith('data:image') ? (
            <img
              src={lightboxUrl}
              alt="Proof document"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', height: '90vh' }}>
              <iframe src={lightboxUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }} title="Document viewer" />
            </div>
          )}
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancellingInv && (
        <div className="modal-overlay" onClick={() => !saving && setCancellingInv(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--warning, #f59e0b)' }}>Cancel Share Collection</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setCancellingInv(null)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                You are about to cancel the share collection for <strong>{cancellingInv.shareholders.first_name} {cancellingInv.shareholders.last_name}</strong> of <strong>{formatCurrency(cancellingInv.amount)}</strong>.
              </p>
              <div className="input-group">
                <label>Reason for Cancellation <span className="required">*</span></label>
                <textarea 
                  className="textarea" 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  placeholder="Required: Why is this share collection being cancelled?" 
                  style={{ minHeight: 80 }} 
                  required 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setCancellingInv(null)} disabled={saving}>Keep Active</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--warning, #f59e0b)', borderColor: 'var(--warning, #f59e0b)' }} onClick={confirmCancel} disabled={saving || !cancelReason.trim()}>
                {saving ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingInv && (
        <div className="modal-overlay" onClick={() => !saving && setDeletingInv(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete Share Collection</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setDeletingInv(null)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to <strong>delete</strong> this share collection record? This removes the entry from your view.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Shareholder:</strong> {deletingInv.shareholders.first_name} {deletingInv.shareholders.last_name}</div>
                <div style={{ marginBottom: 4 }}><strong>Amount:</strong> {formatCurrency(deletingInv.amount)}</div>
                <div><strong>Status:</strong> {deletingInv.status}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeletingInv(null)} disabled={saving}>Go Back</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, .sidebar-overlay, #mobile-sidebar-toggle, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0.5in !important; margin: 0 !important; color: black !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .table-container { border: none !important; }
          .table th { background: #f5f5f5 !important; border: 1px solid #ccc !important; }
          .table td { border: 1px solid #eee !important; color: black !important; padding: 8px !important; }
          .print-period { display: block !important; margin-top: 10px; font-size: 11pt; }
          .badge { background: none !important; border: 1px solid #ccc !important; color: black !important; }
        }
        .print-period { display: none; }
      `}</style>
    </>
  );
}
