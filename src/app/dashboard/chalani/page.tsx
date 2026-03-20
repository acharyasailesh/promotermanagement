'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { 
  Plus, Search, Edit2, Trash2, X, FileText, 
  Printer, Send, User, Building2, Eye, Download,
  Save, ArrowLeft, Mail, MapPin, Calendar, PenTool
} from 'lucide-react';
import NepaliDateInput from '../components/NepaliDateInput';
import { adToBs } from '@/lib/utils/nepaliDate';
import dynamic from 'next/dynamic';

// Dynamic import for ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 350, borderRadius: 12 }} />
});
import 'react-quill-new/dist/quill.snow.css';

interface Chalani {
  id: string;
  fiscal_year_id: string;
  reference_no: string;
  sequence_no: number;
  subject: string;
  recipient_type: 'shareholder' | 'external';
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  content: string;
  signatory_id: string;
  letter_pad_url: string | null;
  created_at: string;
  fiscal_years?: { name: string };
  signatories?: { name: string; signature_url: string | null; designation: string | null };
  shareholders?: { first_name: string; last_name: string; perm_address: any };
}

interface Shareholder {
  id: string;
  first_name: string;
  last_name: string;
  perm_address: any;
}

interface FiscalYear { id: string; name: string; is_current: boolean; }
interface Signatory { id: string; name: string; signature_url: string | null; designation: string | null; profile_id?: string | null; }
interface CompanySettings { company_name: string; address: string; phone: string | null; email: string | null; default_letter_pad_url: string | null; }

export default function ChalaniPage() {
  const supabase = createClient();
  const [chalanis, setChalanis] = useState<Chalani[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [availableSignatories, setAvailableSignatories] = useState<Signatory[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Chalani | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingChalani, setDeletingChalani] = useState<Chalani | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<Chalani | null>(null);
  const [paginatedContent, setPaginatedContent] = useState<string[]>([]);
  const measureRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    subject: '',
    recipient_type: 'shareholder' as 'shareholder' | 'external',
    recipient_id: '',
    recipient_name: '',
    recipient_address: '',
    content: '',
    signatory_id: '',
    fiscal_year_id: '',
    reference_no: 'Generating...'
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [chalRes, fyRes, sigRes, shareRes, setRes] = await Promise.all([
      supabase.from('chalanis')
        .select('*, fiscal_years(name), signatories(name, signature_url, designation), shareholders(first_name, last_name, perm_address)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('fiscal_years').select('*').order('start_date', { ascending: false }),
      supabase.from('signatories').select('id, name, signature_url, designation, profile_id').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('shareholders').select('id, first_name, last_name, perm_address').is('deleted_at', null).order('first_name', { ascending: true }),
      supabase.from('company_settings').select('company_name, address, phone, email, default_letter_pad_url').single()
    ]);

    if (chalRes.data) setChalanis(chalRes.data as any);
    if (fyRes.data) setFiscalYears(fyRes.data as FiscalYear[]);
    if (sigRes.data) setAvailableSignatories(sigRes.data as Signatory[]);
    if (shareRes.data) setShareholders(shareRes.data as Shareholder[]);
    if (setRes.data) setCompanySettings(setRes.data as CompanySettings);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Generate reference number when FY changes
  useEffect(() => {
    if (form.fiscal_year_id && !editing) {
      const generateRef = async () => {
        const { data } = await supabase.rpc('generate_chalani_ref_no', { fy_id: form.fiscal_year_id });
        if (data && data.length > 0) {
          setForm(f => ({ ...f, reference_no: data[0].ref_no || 'Generating...' }));
        }
      };
      generateRef();
    }
  }, [form.fiscal_year_id, editing, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.signatory_id) { toast.error('Please select a signatory'); return; }
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    let finalRef = form.reference_no;
    let finalSeq = 0;

    if (!editing) {
       const { data: refData } = await supabase.rpc('generate_chalani_ref_no', { fy_id: form.fiscal_year_id });
       if (refData && refData.length > 0) {
         finalRef = refData[0].ref_no;
         finalSeq = refData[0].seq;
       }
    }

    const payload: any = {
      subject: form.subject,
      recipient_type: form.recipient_type,
      recipient_id: form.recipient_type === 'shareholder' ? form.recipient_id : null,
      recipient_name: form.recipient_type === 'external' ? form.recipient_name : null,
      recipient_address: form.recipient_type === 'external' ? form.recipient_address : null,
      content: form.content,
      signatory_id: form.signatory_id,
      fiscal_year_id: form.fiscal_year_id,
      created_by: user?.id,
    };

    if (!editing) {
      payload.reference_no = finalRef;
      payload.sequence_no = finalSeq;
    }

    let error;
    if (editing) {
      const { error: err } = await supabase.from('chalanis').update(payload).eq('id', editing.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('chalanis').insert(payload);
      error = err;
    }

    if (error) toast.error('Failed to save'); else { toast.success('Success'); setShowModal(false); fetchAll(); }
    setSaving(false);
  };

  const handleDeleteClick = (chal: Chalani, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingChalani(chal);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingChalani) return;
    setSaving(true);
    const { error } = await supabase.from('chalanis').update({ deleted_at: new Date().toISOString() }).eq('id', deletingChalani.id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      console.error(error);
    } else {
      toast.success('Moved to recycle bin');
      fetchAll();
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    const currentFy = fiscalYears.find(fy => fy.is_current);
    
    supabase.auth.getUser().then(({ data }) => {
       const mySig = availableSignatories.find(s => s.profile_id === data.user?.id);
       setForm({
         subject: '',
         recipient_type: 'shareholder',
         recipient_id: '',
         recipient_name: '',
         recipient_address: '',
         content: '',
         signatory_id: mySig?.id || availableSignatories[0]?.id || '',
         fiscal_year_id: currentFy?.id || '',
         reference_no: 'Generating...'
       });
       setShowModal(true);
    });
  };

  const openEdit = (chal: Chalani) => {
    setEditing(chal);
    setForm({
      subject: chal.subject,
      recipient_type: chal.recipient_type,
      recipient_id: chal.recipient_id || '',
      recipient_name: chal.recipient_name || '',
      recipient_address: chal.recipient_address || '',
      content: chal.content,
      signatory_id: chal.signatory_id,
      fiscal_year_id: chal.fiscal_year_id,
      reference_no: chal.reference_no
    });
    setShowModal(true);
  };

  const getRecipientDisplay = (chal: Chalani) => {
    if (chal.recipient_type === 'shareholder' && chal.shareholders) {
      return `${chal.shareholders.first_name} ${chal.shareholders.last_name}`;
    }
    return chal.recipient_name || 'N/A';
  };

  const filteredChalanis = chalanis.filter(c => {
    const searchLower = search.toLowerCase();
    return (c.subject || '').toLowerCase().includes(searchLower) || 
           (c.reference_no || '').toLowerCase().includes(searchLower) || 
           getRecipientDisplay(c).toLowerCase().includes(searchLower);
  });

  const handlePrint = () => window.print();

  // Real Pagination Logic for Screen Preview
  useEffect(() => {
     if (!previewing || !measureRef.current) {
        setPaginatedContent([]);
        return;
     }

     const measure = measureRef.current;
     // Clean up and wrap content to ensure children exist
     const rawContent = previewing.content.trim();
     measure.innerHTML = rawContent.startsWith('<') ? rawContent : `<p>${rawContent}</p>`;
     
     const timer = setTimeout(() => {
        const pages: string[] = [];
        let currentPage: string[] = [];
        let currentHeight = 0;
        const maxHeight = 700; // Safer threshold (~185mm)

        const blocks = Array.from(measure.children);
        
        blocks.forEach((block: any) => {
           let blockHeight = block.offsetHeight;
           
           // If a single block is too tall, we need a rough mid-block split
           if (blockHeight > maxHeight) {
              // Push what we have
              if (currentPage.length > 0) {
                 pages.push(currentPage.join(''));
                 currentPage = [];
                 currentHeight = 0;
              }
              
              // Split logic for giant blocks (approximate by character chunks)
              const text = block.innerHTML;
              const chunkSize = Math.floor(text.length * (maxHeight / blockHeight));
              let remaining = text;
              
              while (remaining.length > 0) {
                 const cutPoint = remaining.lastIndexOf(' ', chunkSize) || chunkSize;
                 const chunk = remaining.substring(0, cutPoint);
                 pages.push(`<${block.tagName} class="${block.className}">${chunk}</${block.tagName}>`);
                 remaining = remaining.substring(cutPoint).trim();
              }
           } else if (currentHeight + blockHeight > maxHeight && currentPage.length > 0) {
              pages.push(currentPage.join(''));
              currentPage = [block.outerHTML];
              currentHeight = blockHeight;
           } else {
              currentPage.push(block.outerHTML);
              currentHeight += blockHeight;
           }
        });

        if (currentPage.length > 0) pages.push(currentPage.join(''));
        setPaginatedContent(pages.length > 0 ? pages : [previewing.content]);
     }, 150);

     return () => clearTimeout(timer);
  }, [previewing]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  };

  return (
    <>
      <div className="page-header no-print">
        <div><h1 className="page-title text-primary-light flex items-center gap-3"><FileText size={28} /> Chalani System</h1><p className="page-subtitle">Manage and track all outbound documents</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Chalani Record</button>
      </div>

      <div className="page-body no-print">
        <div className="card mb-6">
          <div className="search-input-wrapper"><Search size={18} /><input className="input" placeholder="Search by subject, reference or recipient..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 42 }} /></div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
             {[1,2,3].map(i => <div key={i} className="card skeleton h-24" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredChalanis.length === 0 ? (
               <div className="card empty-state"><FileText size={48} className="text-muted" /><h3>No records found</h3><p>Try adjusting your search filters.</p></div>
            ) : filteredChalanis.map(chal => (
              <div key={chal.id} className="card p-5 border-l-4 border-primary hover:shadow-lg transition-all cursor-default group" onClick={() => setPreviewing(chal)}>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="badge badge-info">{chal.reference_no}</span>
                       <span className="text-muted text-xs flex items-center gap-1"><Calendar size={12}/> {adToBs(chal.created_at.split('T')[0])}</span>
                    </div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{chal.subject}</h3>
                    <div className="flex items-center gap-6 text-muted text-xs mt-2">
                      <span className="flex items-center gap-1.5"><User size={14} className="text-primary"/> <strong>To:</strong> {getRecipientDisplay(chal)}</span>
                      <span className="flex items-center gap-1.5"><PenTool size={14} className="text-primary"/> <strong>Signer:</strong> {chal.signatories?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 no-click-bubble">
                    <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setPreviewing(chal); }} title="Preview"><Eye size={16} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(chal); }} title="Edit"><Edit2 size={16} /></button>
                    <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => handleDeleteClick(chal, e)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay no-print" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 1000, width: '95%' }}>
            <div className="modal-header border-b pb-4">
               <div>
                  <h2 className="modal-title flex items-center gap-2">{editing ? <Edit2 size={20}/> : <Plus size={20}/>} {editing ? 'Edit Chalani Record' : 'Create New Chalani'}</h2>
                  <p className="text-xs text-muted mt-1">Ref No: <span className="font-mono font-bold text-primary">{form.reference_no}</span></p>
               </div>
               <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body py-6">
                <div className="flex flex-col gap-6">
                   {/* Row 1: Primary Details */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="input-group md:col-span-2">
                         <label className="label">Subject of Letter <span className="required">*</span></label>
                         <input className="input" placeholder="e.g. Appointment Letter, Dividend Notice..." value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required />
                      </div>
                      <div className="input-group">
                         <label className="label">Fiscal Year</label>
                         <select className="select" value={form.fiscal_year_id} onChange={e => setForm({...form, fiscal_year_id: e.target.value})} disabled={!!editing}>
                            {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name} {fy.is_current ? '(Current)' : ''}</option>)}
                         </select>
                      </div>
                   </div>

                   {/* Row 2: Recipient Selection */}
                   <div className="p-4 rounded-xl bg-secondary/20 border border-primary/10">
                      <div className="flex items-center justify-between mb-4">
                         <label className="label font-bold flex items-center gap-2"><User size={16}/> Recipient Information</label>
                         <div className="flex gap-4 p-1 bg-card rounded-lg border shadow-sm">
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all ${form.recipient_type === 'shareholder' ? 'bg-primary text-white' : 'hover:bg-secondary'}`}>
                               <input type="radio" className="hidden" checked={form.recipient_type === 'shareholder'} onChange={() => setForm({...form, recipient_type: 'shareholder'})} />
                               Shareholder
                            </label>
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all ${form.recipient_type === 'external' ? 'bg-primary text-white' : 'hover:bg-secondary'}`}>
                               <input type="radio" className="hidden" checked={form.recipient_type === 'external'} onChange={() => setForm({...form, recipient_type: 'external'})} />
                               External
                            </label>
                         </div>
                      </div>

                      {form.recipient_type === 'shareholder' ? (
                         <div className="input-group">
                            <select className="select" value={form.recipient_id} onChange={e => setForm({...form, recipient_id: e.target.value})} required>
                               <option value="">-- Search and Select Shareholder --</option>
                               {shareholders.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                            </select>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="input-group">
                               <input className="input" placeholder="Recipient Full Name/Designation" value={form.recipient_name} onChange={e => setForm({...form, recipient_name: e.target.value})} required />
                            </div>
                            <div className="input-group">
                               <div className="relative">
                                  <MapPin size={14} className="absolute left-3 top-3 text-muted" />
                                  <input className="input pl-9" placeholder="Full Address (e.g. New Road, Pokhara)" value={form.recipient_address} onChange={e => setForm({...form, recipient_address: e.target.value})} />
                               </div>
                            </div>
                         </div>
                      )}
                   </div>

                   {/* Row 3: Rich Text Editor */}
                   <div className="input-group">
                      <label className="label font-bold mb-2 block flex items-center gap-2"><FileText size={16}/> Letter Content</label>
                      <div className="editor-container" style={{ minHeight: 400, marginBottom: 40 }}>
                         <ReactQuill theme="snow" value={form.content} onChange={val => setForm({...form, content: val})} modules={quillModules} placeholder="Start writing your letter here..." />
                      </div>
                   </div>

                   {/* Row 4: Signatory Selection */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end border-t pt-6">
                      <div className="input-group">
                         <label className="label font-bold flex items-center gap-2"><PenTool size={16}/> Authorized Signatory <span className="required">*</span></label>
                         <select className="select" value={form.signatory_id} onChange={e => setForm({...form, signatory_id: e.target.value})} required>
                            <option value="">-- Choose who will sign this letter --</option>
                            {availableSignatories.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>)}
                         </select>
                      </div>
                      <div className="flex justify-end gap-3">
                         <button type="button" className="btn btn-secondary px-8" onClick={() => setShowModal(false)}>Cancel</button>
                         <button className="btn btn-primary px-10 shadow-lg shadow-primary/20" disabled={saving}>
                            <Save size={18}/> {saving ? 'Processing...' : editing ? 'Update Record' : 'Save & Close'}
                         </button>
                      </div>
                   </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewing && (
        <div className="print-overlay">
          <div className="print-toolbar no-print">
            <button className="btn btn-secondary" onClick={() => setPreviewing(null)}><ArrowLeft size={16} /> Back</button>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => window.location.href=`mailto:?subject=${encodeURIComponent(previewing.subject)}`}><Mail size={16} /> Send as Email</button>
              <button className="btn btn-primary shadow-lg shadow-primary/30 px-6" onClick={handlePrint}><Printer size={16} /> Print Letter</button>
            </div>
          </div>
          <div className="print-canvas">
             <div ref={measureRef} className="ql-editor" style={{ 
                position: 'absolute', 
                visibility: 'hidden', 
                width: '170mm', // 210mm - (20mm * 2) padding
                padding: 0,
                pointerEvents: 'none',
                lineHeight: 1.8,
                fontSize: 18
             }} />

             {paginatedContent.map((pageHtml, index) => (
                <div key={index} className="preview-page">
                   <table className="letter-table" style={companySettings?.default_letter_pad_url ? { backgroundImage: `url(${companySettings.default_letter_pad_url})` } : {}}>
                      <thead className="letter-thead">
                         <tr><td><div className="header-spacer" /></td></tr>
                      </thead>
                      <tbody>
                         <tr>
                            <td>
                               <div className="letter-content-wrapper">
                                  {index === 0 && (
                                     <>
                                        <div className="letter-header-stats">
                                           <div className="ref-no">{previewing.reference_no}</div>
                                           <div className="date">{adToBs(previewing.created_at.split('T')[0])}</div>
                                        </div>
                                        <div className="letter-recipient">
                                           <div className="to-label">To,</div>
                                           <div className="recipient-name">{previewing.recipient_type === 'shareholder' ? `${previewing.shareholders?.first_name} ${previewing.shareholders?.last_name}` : previewing.recipient_name}</div>
                                           <div className="recipient-addr">{previewing.recipient_type === 'shareholder' ? 'Pokhara, Nepal' : previewing.recipient_address}</div>
                                        </div>
                                        <div className="letter-subject">Subject: <u>{previewing.subject}</u></div>
                                     </>
                                  )}
                                  
                                  <div className="letter-body ql-editor" dangerouslySetInnerHTML={{ __html: pageHtml }} />
                                  
                                  {index === paginatedContent.length - 1 && (
                                     <div className="letter-closing">
                                        <div className="signature-area">
                                           {previewing.signatories?.signature_url && <img src={previewing.signatories.signature_url} className="signature-img" />}
                                           <div className="sign-line" />
                                           <div className="sign-name">{previewing.signatories?.name}</div>
                                           <div className="sign-role">{previewing.signatories?.designation}</div>
                                        </div>
                                     </div>
                                  )}
                               </div>
                            </td>
                         </tr>
                      </tbody>
                      <tfoot className="letter-tfoot">
                         <tr><td><div className="footer-spacer" /></td></tr>
                      </tfoot>
                   </table>
                </div>
             ))}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingChalani && (
        <div className="modal-overlay no-print" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this Chalani record? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Subject:</strong> {deletingChalani.subject}</div>
                <div><strong>Ref No:</strong> {deletingChalani.reference_no}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @page { 
          size: A4; 
          margin: 0 !important; 
        }
        @media print {
          .no-print { display: none !important; }
          body { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .print-overlay { 
            position: static; 
            width: 100%; 
            height: auto; 
            background: white; 
            z-index: 10000; 
            overflow: visible; 
            padding: 0 !important; 
            margin: 0 !important; 
            display: block; 
          }
          .print-canvas { 
             width: 210mm; 
             margin: 0 !important;
             background-color: white !important;
             position: relative;
             overflow: visible;
          }
          .letter-table { 
             width: 210mm;
             border-collapse: collapse; 
             table-layout: fixed; 
             background-size: 210mm 297mm;
             background-repeat: repeat-y;
             background-position: top center;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }
          .letter-content-wrapper { padding: 0 25mm !important; word-wrap: break-word; }
          .header-spacer { height: 45mm; }
          .footer-spacer { height: 55mm; }
          .print-toolbar { display: none !important; }
        }
        
        .no-click-bubble { pointer-events: auto; }
        
        .print-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(15, 23, 42, 0.9); z-index: 1000; display:flex; flex-direction:column; align-items:center; overflow-y:auto; padding:40px 20px; }
        .print-toolbar { width: 210mm; background: var(--bg-card); padding: 16px 24px; border-radius: 12px; margin-bottom: 24px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
        .print-canvas { 
           width: 210mm; 
           background: #f1f5f9; 
           padding: 40px 0; 
           position: relative; 
        }
        .preview-page {
           margin-bottom: 40px;
           page-break-after: always;
        }
        .letter-table { 
           width: 210mm; 
           margin: 0 auto;
           background-color: white;
           border-collapse: collapse;
           table-layout: fixed;
           background-size: 210mm 297mm;
           background-repeat: no-repeat;
           background-position: top center;
           min-height: 297mm;
           box-shadow: 0 10px 50px rgba(0,0,0,0.2);
        }
        .letter-content-wrapper { padding: 0 20mm; position: relative; }
        .header-spacer { height: 45mm; }
        .footer-spacer { height: 55mm; }
        
        .letter-header-stats { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 25px; font-size: 16px; padding-top: 5mm; }
        .ref-no { transform: translateY(18px); margin-left: 10mm; }
        .date { transform: translateY(24px); margin-right: 5mm; }
        
        .letter-recipient { margin-bottom: 35px; font-size: 17px; }
        .recipient-name { font-weight: bold; font-size: 20px; }
        .letter-subject { text-align: center; font-weight: bold; font-size: 19px; margin: 35px 0 45px 0; }
        .letter-body { font-size: 18px; min-height: 100px; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.8; }
        .letter-body p { margin-bottom: 15px; }
        
        @media print {
          .preview-page { margin-bottom: 0; }
          .letter-table { box-shadow: none; width: 210mm; height: 297mm; }
          .print-canvas { padding: 0; background: none; width: 100%; }
        }

        /* Paragraph formatting to match editor */
        .letter-body p { margin-bottom: 12px; line-height: 1.6; }
        .letter-body p:last-child { margin-bottom: 0; }
        .letter-body br { display: block; content: ""; margin-top: 12px; }

        .letter-closing { display: flex; justify-content: flex-end; width: 100%; margin-top: 40px; }
        .signature-area { 
           width: 250px; 
           text-align: center; 
           position: relative;
        }
        .signature-img { 
           max-height: 85px; 
           max-width: 180px; 
           object-fit: contain; 
           mix-blend-mode: multiply; 
           margin: 0 auto;
           display: block;
           margin-bottom: -15px; /* Pull line closer to sig */
        }
        .sign-line { border-top: 1.5px solid black; margin: 10px auto 5px; width: 100%; }
        .sign-name { font-weight: bold; font-size: 17px; }
        .sign-role { font-size: 14px; color: #333; font-style: italic; }
        
        /* Modal Customizations */
        .ql-container.ql-snow { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
        .ql-toolbar.ql-snow { border-top-left-radius: 12px; border-top-right-radius: 12px; border-bottom: 0; background: var(--bg-secondary); }
        .ql-editor { font-size: 16px; min-height: 300px; padding: 20px; }
      `}</style>
    </>
  );
}
