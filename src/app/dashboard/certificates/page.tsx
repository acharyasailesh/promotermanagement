'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, X, Award, ArrowRightLeft, Edit2, Trash2, Calendar, Printer, UserCheck, FileText, Upload } from 'lucide-react';
import { adToBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';

interface Certificate {
  id: string;
  shareholder_id: string;
  certificate_no: string;
  investment_id: string | null;
  num_shares: number;
  face_value: number;
  kitta_from: number | null;
  kitta_to: number | null;
  issue_date: string;
  status: string;
  transferred_to: string | null;
  transfer_reason: string | null;
  taken_date: string | null;
  taken_by_type: 'self' | 'behalf' | null;
  taken_by_name: string | null;
  taken_by_relationship: string | null;
  taken_by_mobile: string | null;
  taken_signature_url: string | null;
  issued_by_id: string | null;
  shareholders: { first_name: string; last_name: string; phone_number?: string };
}

interface ShareholderOption { 
  id: string; 
  first_name: string; 
  last_name: string; 
  member_id?: number;
}

interface InvestmentOption {
  id: string;
  investment_date: string;
  amount: number;
  payment_method: string;
  status: string;
}

export default function CertificatesPage() {
  const supabase = createClient();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedShareholder, setSelectedShareholder] = useState('');
  const [availableInvestments, setAvailableInvestments] = useState<InvestmentOption[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [faceValue, setFaceValue] = useState('100');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [calculatedShares, setCalculatedShares] = useState(0);
  const [kittaFrom, setKittaFrom] = useState(1);
  const [kittaTo, setKittaTo] = useState(0);
  const [loadingInvestments, setLoadingInvestments] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [editForm, setEditForm] = useState({
    kitta_from: '',
    kitta_to: '',
    num_shares: '',
    face_value: '',
    issue_date: '',
    status: '',
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCert, setDeletingCert] = useState<Certificate | null>(null);

  // Sorting state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Collection Tracking state
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [trackingCert, setTrackingCert] = useState<Certificate | null>(null);
  const [collectionForm, setCollectionForm] = useState({
    taken_date: new Date().toISOString().split('T')[0],
    taken_by_type: 'self' as 'self' | 'behalf',
    taken_by_name: '',
    taken_by_relationship: '',
    taken_by_mobile: '',
    taken_signature_url: '',
  });
  const [uploading, setUploading] = useState(false);

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('share_certificates')
      .select('*, shareholders!share_certificates_shareholder_id_fkey(first_name, last_name, phone_number)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Certificates fetch error:', error);
      toast.error(`Failed to load: ${error.message}`);
    }
    setCerts((data || []).map((c: Record<string, unknown>) => ({
      ...c,
      shareholders: c.shareholders || { first_name: 'Unknown', last_name: '' },
    })) as Certificate[]);
    setLoading(false);
  }, [supabase]);

  const fetchShareholders = useCallback(async () => {
    const { data } = await supabase
      .from('shareholders')
      .select('id, first_name, last_name, created_at')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('created_at', { ascending: true }); // Ensure deterministic order to calculate ID
    
    // Assign incremental ID based on joining time
    const members = (data || []).map((sh, idx) => ({ ...sh, member_id: idx + 1 }));
    setShareholders(members as ShareholderOption[]);
  }, [supabase]);

  useEffect(() => { fetchCerts(); fetchShareholders(); }, [fetchCerts, fetchShareholders]);

  // When shareholder changes, fetch their unissued investments
  const handleShareholderChange = async (shareholderId: string) => {
    setSelectedShareholder(shareholderId);
    setSelectedInvestmentId('');
    setSelectedAmount(0);
    setCalculatedShares(0);
    setKittaTo(0);
    setAvailableInvestments([]);

    if (!shareholderId) {
      setKittaFrom(1);
      return;
    }

    // Get global max kitta_to across ALL certificates (including transferred)
    const { data: globalCertData } = await supabase
      .from('share_certificates')
      .select('kitta_to')
      .order('kitta_to', { ascending: false })
      .limit(1);

    const globalMaxKitta = globalCertData && globalCertData.length > 0 && globalCertData[0].kitta_to ? globalCertData[0].kitta_to : 0;
    setKittaFrom(globalMaxKitta + 1);

    // Get this shareholder's issued investment IDs
    const { data: shCertData } = await supabase
      .from('share_certificates')
      .select('investment_id')
      .eq('shareholder_id', shareholderId);

    const issuedInvestmentIds = (shCertData || [])
      .map((c: { investment_id: string | null }) => c.investment_id)
      .filter(Boolean) as string[];

    // Fetch verified investments for this shareholder
    setLoadingInvestments(true);
    const { data: invData } = await supabase
      .from('investments')
      .select('id, investment_date, amount, payment_method, status')
      .eq('shareholder_id', shareholderId)
      .eq('status', 'verified')
      .order('investment_date', { ascending: true });

    // Filter out already-issued investments
    const unissued = (invData || []).filter(
      (inv: InvestmentOption) => !issuedInvestmentIds.includes(inv.id)
    );

    setAvailableInvestments(unissued);
    setLoadingInvestments(false);
  };

  // When investment is selected
  const handleInvestmentSelect = (investmentId: string) => {
    setSelectedInvestmentId(investmentId);
    const inv = availableInvestments.find(i => i.id === investmentId);
    if (inv) {
      setSelectedAmount(inv.amount);
      const fv = parseFloat(faceValue) || 100;
      const shares = Math.floor(inv.amount / fv);
      setCalculatedShares(shares);
      setKittaTo(kittaFrom + shares - 1);
    } else {
      setSelectedAmount(0);
      setCalculatedShares(0);
      setKittaTo(0);
    }
  };

  const handleFaceValueChange = (val: string) => {
    setFaceValue(val);
    if (selectedAmount && val) {
      const shares = Math.floor(selectedAmount / parseFloat(val));
      setCalculatedShares(shares);
      setKittaTo(kittaFrom + shares - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedShares <= 0) { toast.error('Invalid shares calculation'); return; }
    if (!selectedInvestmentId) { toast.error('Please select an investment'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const selectedSh = shareholders.find(s => s.id === selectedShareholder);
    const certificateNo = selectedSh ? String(selectedSh.member_id) : selectedShareholder;

    const { error } = await supabase.from('share_certificates').insert({
      shareholder_id: selectedShareholder,
      certificate_no: certificateNo, // Replaced UUID with sequentially incremented member_id
      investment_id: selectedInvestmentId,
      num_shares: calculatedShares,
      face_value: parseFloat(faceValue),
      kitta_from: kittaFrom,
      kitta_to: kittaTo,
      issue_date: issueDate,
      created_by: user?.id,
      issued_by_id: user?.id,
    });
    if (error) toast.error(error.message); else { toast.success('Certificate issued'); setShowModal(false); fetchCerts(); }
    setSaving(false);
  };

  const handleTransfer = async (cert: Certificate) => {
    const toId = prompt('Enter the shareholder ID to transfer to:');
    if (!toId) return;
    const reason = prompt('Transfer reason:') || '';
    const { error } = await supabase.from('share_certificates').update({
      status: 'transferred', transferred_to: toId, transferred_at: new Date().toISOString(), transfer_reason: reason,
    }).eq('id', cert.id);
    if (error) toast.error(error.message); else { toast.success('Certificate transferred'); fetchCerts(); }
  };

  // Edit certificate
  const openEditCert = (cert: Certificate) => {
    setEditingCert(cert);
    setEditForm({
      kitta_from: String(cert.kitta_from || ''),
      kitta_to: String(cert.kitta_to || ''),
      num_shares: String(cert.num_shares),
      face_value: String(cert.face_value),
      issue_date: cert.issue_date,
      status: cert.status,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCert) return;
    setSaving(true);
    const { error } = await supabase.from('share_certificates').update({
      kitta_from: editForm.kitta_from ? parseInt(editForm.kitta_from) : null,
      kitta_to: editForm.kitta_to ? parseInt(editForm.kitta_to) : null,
      num_shares: parseInt(editForm.num_shares),
      face_value: parseFloat(editForm.face_value),
      issue_date: editForm.issue_date,
      status: editForm.status,
    }).eq('id', editingCert.id);
    if (error) toast.error(error.message); else { toast.success('Certificate updated'); setShowEditModal(false); fetchCerts(); }
    setSaving(false);
  };

  // Delete certificate via custom modal
  const handleDelete = (cert: Certificate) => {
    setDeletingCert(cert);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingCert) return;
    setSaving(true);
    const { error } = await supabase.from('share_certificates').update({ deleted_at: new Date().toISOString() }).eq('id', deletingCert.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Certificate deleted successfully');
      fetchCerts();
      setShowDeleteModal(false);
      setDeletingCert(null);
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `certificates/signatures/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
    } else {
      setCollectionForm(prev => ({ ...prev, taken_signature_url: publicUrlData.publicUrl }));
      toast.success('File uploaded');
    }
    setUploading(false);
  };

  const openCollectionModal = (cert: Certificate) => {
    setTrackingCert(cert);
    setCollectionForm({
      taken_date: new Date().toISOString().split('T')[0],
      taken_by_type: 'self',
      taken_by_name: '',
      taken_by_relationship: '',
      taken_by_mobile: cert.shareholders.phone_number || '',
      taken_signature_url: '',
    });
    setShowCollectionModal(true);
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCert) return;

    setSaving(true);
    const { error } = await supabase
      .from('share_certificates')
      .update({
        taken_date: collectionForm.taken_date,
        taken_by_type: collectionForm.taken_by_type,
        taken_by_name: collectionForm.taken_by_type === 'behalf' ? collectionForm.taken_by_name : null,
        taken_by_relationship: collectionForm.taken_by_type === 'behalf' ? collectionForm.taken_by_relationship : null,
        taken_by_mobile: collectionForm.taken_by_mobile,
        taken_signature_url: collectionForm.taken_signature_url,
      })
      .eq('id', trackingCert.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Collection recorded');
      setShowCollectionModal(false);
      fetchCerts();
    }
    setSaving(false);
  };

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const statusBadge = (s: string) => s === 'active' ? 'badge-success' : s === 'transferred' ? 'badge-info' : 'badge-danger';

  const filtered = certs.filter((c) => {
    const name = `${c.shareholders.first_name} ${c.shareholders.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) || c.certificate_no.toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const shA = shareholders.find(s => s.id === a.shareholder_id);
    const shB = shareholders.find(s => s.id === b.shareholder_id);
    const idA = shA?.member_id || 0;
    const idB = shB?.member_id || 0;
    
    return sortOrder === 'asc' ? idA - idB : idB - idA;
  });

  const totalShares = certs.filter(c => c.status === 'active').reduce((s, c) => s + c.num_shares, 0);

  const getShareholderName = (shareholderId: string) => {
    const sh = shareholders.find(s => s.id === shareholderId);
    return sh ? `${sh.first_name} ${sh.last_name}` : shareholderId.substring(0, 8);
  };

  const resetModal = () => {
    setSelectedShareholder('');
    setSelectedInvestmentId('');
    setSelectedAmount(0);
    setAvailableInvestments([]);
    setFaceValue('100');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setCalculatedShares(0);
    setKittaFrom(1);
    setKittaTo(0);
    setShowModal(true);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Share Certificates</h1>
          <p className="page-subtitle">{certs.length} certificates &bull; {totalShares} active kitta</p>
        </div>
        <button className="btn btn-primary" onClick={resetModal}>
          <Plus size={16} /> Issue Certificate
        </button>
      </div>
      <div className="page-body">
        <div className="search-bar">
          <div className="search-input-wrapper" style={{ maxWidth: 400 }}>
            <Search size={16} />
            <input className="input" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
          </div>
        </div>
        {loading ? <div className="card">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)}</div> : filtered.length === 0 ? (
          <div className="card empty-state"><Award size={48} /><h3>No certificates issued</h3><p>Issue share certificates to your shareholders.</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="flex items-center gap-1">
                      Shareholder ID
                      <span style={{ fontSize: 10, opacity: 0.5 }}>
                        {sortOrder === 'asc' ? '▲' : '▼'}
                      </span>
                    </div>
                  </th>
                  <th>Shareholder</th>
                  <th>Kitta Range</th>
                  <th>No. of Kitta</th>
                  <th>Par Value</th>
                  <th>Total Value</th>
                  <th>Issue Date</th>
                  <th>Tracking</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  // Find the shareholder to get their sequential member_id instead of showing old UUIDs
                  const sh = shareholders.find(s => s.id === c.shareholder_id);
                  const displayId = sh?.member_id || '?';
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>
                            {displayId}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {c.shareholders.first_name} {c.shareholders.last_name}
                      </td>
                    <td>
                      {c.kitta_from && c.kitta_to ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-light)' }}>
                          {c.kitta_from} — {c.kitta_to}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.num_shares.toLocaleString()}</td>
                    <td>{formatCurrency(c.face_value)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(c.num_shares * c.face_value)}</td>
                    <td>{adToBs(c.issue_date)}</td>
                    <td>
                      {c.taken_date ? (
                        <div className="flex flex-col">
                          <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>
                            Collected
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {adToBs(c.taken_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 6px' }}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        {c.status === 'active' && (
                          <>
                            {!c.taken_date && (
                              <button className="btn btn-ghost btn-sm" onClick={() => openCollectionModal(c)} title="Record Collection" style={{ color: 'var(--primary-light)' }}>
                                <UserCheck size={14} /> Collect
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleTransfer(c)} title="Transfer">
                              <ArrowRightLeft size={14} /> Transfer
                            </button>
                          </>
                        )}
                         <button className="btn btn-ghost btn-icon" onClick={() => window.open(`/dashboard/certificates/${c.id}/print`, '_blank')} title="Print">
                           <Printer size={16} />
                         </button>
                         <button className="btn btn-ghost btn-icon" onClick={() => openEditCert(c)} title="Edit">
                           <Edit2 size={16} />
                         </button>
                         <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(c)} title="Delete" style={{ color: 'var(--danger)' }}>
                           <Trash2 size={16} />
                         </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ISSUE CERTIFICATE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Issue Share Certificate</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {/* Step 1: Select Shareholder */}
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Shareholder <span className="required">*</span></label>
                    <select className="select" value={selectedShareholder} onChange={(e) => handleShareholderChange(e.target.value)} required>
                      <option value="">Select shareholder...</option>
                      {shareholders.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          #{sh.member_id} - {sh.first_name} {sh.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Select Share Collection (only unissued ones) */}
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Share Collection <span className="required">*</span></label>
                    {!selectedShareholder ? (
                      <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                        Select a shareholder first
                      </div>
                    ) : loadingInvestments ? (
                      <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                        Loading investments...
                      </div>
                    ) : availableInvestments.length === 0 ? (
                      <div style={{
                        padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, fontSize: 13, color: '#ef4444',
                      }}>
                        No unissued verified investments for this shareholder
                      </div>
                    ) : (
                      <select className="select" value={selectedInvestmentId} onChange={(e) => handleInvestmentSelect(e.target.value)} required>
                        <option value="">Select investment...</option>
                        {availableInvestments.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {adToBs(inv.investment_date)} — Rs. {inv.amount.toLocaleString('en-IN')} ({inv.payment_method})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Par Value and Issue Date */}
                  <div className="input-group">
                    <label>Par Value (Rs.)</label>
                    <input type="number" step="0.01" className="input" value={faceValue} onChange={(e) => handleFaceValueChange(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label>Issue Date (BS)</label>
                    <NepaliDateInput 
                      value={issueDate} 
                      onChange={(ad) => setIssueDate(ad)} 
                      align="right"
                    />
                  </div>

                  {/* Auto-calculated summary */}
                  {calculatedShares > 0 && (
                    <div style={{
                      gridColumn: 'span 2',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: 12,
                      padding: '16px 20px',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-light)', textTransform: 'uppercase', marginBottom: 12 }}>
                        Certificate Summary
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kitta (Shares)</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{calculatedShares.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kitta Range</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-light)', fontFamily: 'monospace' }}>
                            {kittaFrom} — {kittaTo}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Value</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
                            {formatCurrency(selectedAmount)}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        Certificate No: <strong style={{ color: 'var(--text-primary)' }}>{getShareholderName(selectedShareholder)}</strong>
                        {' '}&bull;{' '}
                        Rs. {selectedAmount.toLocaleString('en-IN')} ÷ Rs. {parseFloat(faceValue).toLocaleString()} = {calculatedShares.toLocaleString()} kitta
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || calculatedShares <= 0 || !selectedInvestmentId}>
                  {saving ? 'Issuing...' : 'Issue Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD COLLECTION MODAL */}
      {showCollectionModal && trackingCert && (
        <div className="modal-overlay" onClick={() => !saving && setShowCollectionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Certificate Collection</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowCollectionModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <form onSubmit={handleCollectionSubmit}>
              <div className="modal-body">
                <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div><strong>Shareholder:</strong> {trackingCert.shareholders.first_name} {trackingCert.shareholders.last_name}</div>
                  <div><strong>Kitta Range:</strong> {trackingCert.kitta_from} — {trackingCert.kitta_to} ({trackingCert.num_shares} Kitta)</div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group">
                    <label>Collection Date (BS)</label>
                    <NepaliDateInput 
                      value={collectionForm.taken_date} 
                      onChange={(ad) => setCollectionForm(p => ({ ...p, taken_date: ad }))} 
                      align="left"
                    />
                  </div>
                  <div className="input-group">
                    <label>Collected By</label>
                    <select 
                      className="select" 
                      value={collectionForm.taken_by_type} 
                      onChange={(e) => setCollectionForm(p => ({ ...p, taken_by_type: e.target.value as 'self' | 'behalf' }))}
                    >
                      <option value="self">Shareholder (Self)</option>
                      <option value="behalf">Authorized Representative (On Behalf)</option>
                    </select>
                  </div>

                  {collectionForm.taken_by_type === 'behalf' && (
                    <>
                      <div className="input-group">
                        <label>Representative Name <span className="required">*</span></label>
                        <input 
                          type="text" 
                          className="input" 
                          value={collectionForm.taken_by_name} 
                          onChange={(e) => setCollectionForm(p => ({ ...p, taken_by_name: e.target.value }))} 
                          placeholder="Full Name"
                          required 
                        />
                      </div>
                      <div className="input-group">
                        <label>Relationship <span className="required">*</span></label>
                        <input 
                          type="text" 
                          className="input" 
                          value={collectionForm.taken_by_relationship} 
                          onChange={(e) => setCollectionForm(p => ({ ...p, taken_by_relationship: e.target.value }))} 
                          placeholder="e.g. Son, Daughter, Agent"
                          required 
                        />
                      </div>
                    </>
                  )}

                  <div className="input-group">
                    <label>Mobile Number <span className="required">*</span></label>
                    <input 
                      type="text" 
                      className="input" 
                      value={collectionForm.taken_by_mobile} 
                      onChange={(e) => setCollectionForm(p => ({ ...p, taken_by_mobile: e.target.value }))} 
                      placeholder="Mobile number"
                      required 
                    />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Signature/Authorization Proof {collectionForm.taken_by_type === 'behalf' && <span className="required">*</span>}</label>
                    {collectionForm.taken_signature_url ? (
                      <div className="flex items-center gap-3 p-3 bg-success-light border border-success/30 rounded-lg">
                        <FileText size={20} className="text-success" />
                        <span className="text-xs flex-1 truncate">Document uploaded</span>
                        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setCollectionForm(p => ({ ...p, taken_signature_url: '' }))}>Remove</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input 
                          type="file" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <Upload size={24} className="text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload signature/proof'}</span>
                          <span className="text-xs text-gray-400 mt-1">PNG, JPG, or PDF (Max 5MB)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCollectionModal(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving || uploading || (collectionForm.taken_by_type === 'behalf' && !collectionForm.taken_signature_url)}
                >
                  {saving ? 'Recording...' : 'Record Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CERTIFICATE MODAL */}
      {showEditModal && editingCert && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Certificate</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {/* Shareholder info (read-only) */}
                <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {editingCert.shareholders.first_name} {editingCert.shareholders.last_name}
                  </strong>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group">
                    <label>Kitta From</label>
                    <input type="number" min="1" className="input" value={editForm.kitta_from} onChange={(e) => setEditForm(p => ({ ...p, kitta_from: e.target.value }))} placeholder="Start kitta" />
                  </div>
                  <div className="input-group">
                    <label>Kitta To</label>
                    <input type="number" min="1" className="input" value={editForm.kitta_to} onChange={(e) => setEditForm(p => ({ ...p, kitta_to: e.target.value }))} placeholder="End kitta" />
                  </div>
                  <div className="input-group">
                    <label>No. of Kitta <span className="required">*</span></label>
                    <input type="number" min="1" className="input" value={editForm.num_shares} onChange={(e) => setEditForm(p => ({ ...p, num_shares: e.target.value }))} required />
                  </div>
                  <div className="input-group">
                    <label>Par Value (Rs.) <span className="required">*</span></label>
                    <input type="number" step="0.01" className="input" value={editForm.face_value} onChange={(e) => setEditForm(p => ({ ...p, face_value: e.target.value }))} required />
                  </div>
                   <div className="input-group">
                    <label>Issue Date (BS)</label>
                    <NepaliDateInput 
                      value={editForm.issue_date} 
                      onChange={(ad) => setEditForm(p => ({ ...p, issue_date: ad }))} 
                      align="left"
                    />
                  </div>
                  <div className="input-group">
                    <label>Status</label>
                    <select className="select" value={editForm.status} onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="transferred">Transferred</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Tracking Info (Read-only for now, but editable via collection modal) */}
                  {editingCert.taken_date && (
                    <div style={{ gridColumn: 'span 2', marginTop: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Collection Info</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                        <div><span className="text-muted">Collected On:</span> {adToBs(editingCert.taken_date)}</div>
                        <div><span className="text-muted">Type:</span> {editingCert.taken_by_type === 'self' ? 'Self' : 'On Behalf'}</div>
                        {editingCert.taken_by_name && <div><span className="text-muted">Name:</span> {editingCert.taken_by_name}</div>}
                        {editingCert.taken_by_mobile && <div><span className="text-muted">Mobile:</span> {editingCert.taken_by_mobile}</div>}
                        {editingCert.taken_signature_url && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <a href={editingCert.taken_signature_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                              <FileText size={14} /> View Proof Document
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Certificate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingCert && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to <strong>delete</strong> this certificate? This record will be removed from the active list.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 8 }}><strong>Shareholder:</strong> {deletingCert.shareholders.first_name} {deletingCert.shareholders.last_name}</div>
                <div style={{ marginBottom: 8 }}><strong>Shares:</strong> {deletingCert.num_shares.toLocaleString()} Kitta</div>
                <div style={{ marginBottom: 8 }}><strong>Kitta Range:</strong> {deletingCert.kitta_from || '?'} — {deletingCert.kitta_to || '?'}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
