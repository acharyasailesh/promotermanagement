'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Upload,
  Filter,
  Copy,
  MapPin,
  Download,
  Printer,
  Landmark,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import NEPAL_DETAILED from '@/lib/constants/nepal_detailed.json';
import { adToBs, bsToAd, getCurrentBsDate } from '@/lib/utils/nepaliDate';
import NepaliDate from 'nepali-date-converter';
import NepaliDateInput from '../components/NepaliDateInput';
import { processImage } from '@/lib/utils/imageProcess';

interface NepalCity {
  municipality_id: number;
  name: string;
}

interface NepalDistrict {
  district_id: number;
  name: string;
  cities: NepalCity[];
}

interface NepalProvince {
  province_id: number;
  name: string;
  districts: NepalDistrict[];
}

const normalize = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
};

const nepalData = normalize(NEPAL_DETAILED);

const NEPAL_ZONES = [
  { name: 'Mechi', districts: ['Taplejung', 'Panchthar', 'Ilam', 'Jhapa'] },
  { name: 'Kosi', districts: ['Sankhuwasabha', 'Tehrathum', 'Dhankuta', 'Bhojpur', 'Sunsari', 'Morang'] },
  { name: 'Sagarmatha', districts: ['Solukhumbu', 'Okhaldhunga', 'Khotang', 'Udayapur', 'Saptari', 'Siraha'] },
  { name: 'Janakpur', districts: ['Dhanusha', 'Mahottari', 'Sarlahi', 'Sindhuli', 'Ramechhap', 'Dolakha'] },
  { name: 'Bagmati', districts: ['Rasuwa', 'Nuwakot', 'Kathmandu', 'Bhaktapur', 'Lalitpur', 'Kavrepalanchok', 'Sindhupalchok', 'Dhading'] },
  { name: 'Narayani', districts: ['Makwanpur', 'Rautahat', 'Bara', 'Parsa', 'Chitwan'] },
  { name: 'Gandaki', districts: ['Gorkha', 'Lamjung', 'Tanahu', 'Syangja', 'Kaski', 'Manang'] },
  { name: 'Lumbini', districts: ['Gulmi', 'Arghakhanchi', 'Palpa', 'Nawalparasi', 'Rupandehi', 'Kapilvastu'] },
  { name: 'Dhaulagiri', districts: ['Mustang', 'Myagdi', 'Baglung', 'Parwat'] },
  { name: 'Rapti', districts: ['Rukum', 'Rolpa', 'Salyan', 'Pyuthan', 'Dang'] },
  { name: 'Bheri', districts: ['Jajarkot', 'Dailekh', 'Surkhet', 'Banke', 'Bardiya'] },
  { name: 'Karnali', districts: ['Dolpa', 'Jumla', 'Kalikot', 'Mugu', 'Humla'] },
  { name: 'Seti', districts: ['Bajura', 'Bajhang', 'Achham', 'Doti', 'Kailali'] },
  { name: 'Mahakali', districts: ['Darchula', 'Baitadi', 'Dadeldhura', 'Kanchanpur'] }
];

interface Shareholder {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  father_name: string | null;
  grandfather_name: string | null;
  spouse_name: string | null;
  children: Array<{ name: string; relation: string }>;
  in_laws: { mother_in_law?: string; father_in_law?: string };
  temp_address: Record<string, string> | null;
  perm_address: Record<string, string>;
  cit_address: Record<string, string> | null;
  citizenship_no: string;
  citizenship_district: string;
  citizenship_issue_date: string;
  email: string | null;
  pan_no: string | null;
  nid_no: string | null;
  demat_no: string | null;
  bank_details: Array<{ bank_name: string; branch_name: string; account_no: string }>;
  profile_pic_url: string | null;
  phone_number: string | null;
  deleted_at: string | null;
  kyc_status: string;
  kyc_notes: string | null;
  member_since: string;
  is_active: boolean;
  created_at: string;
  member_id?: number; // Sequential ID (1, 2, 3...)
  citizenship_photo_url: string | null;
  nid_photo_url: string | null;
  nominee_citizenship_url: string | null;
  nominee_profile_pic_url: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  share_form_url: string | null;
  first_name_ne: string | null;
  middle_name_ne: string | null;
  last_name_ne: string | null;
  father_name_ne: string | null;
  grandfather_name_ne: string | null;
  nominee_name_ne: string | null;
}

const emptyForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  first_name_ne: '',
  middle_name_ne: '',
  last_name_ne: '',
  father_name: '',
  grandfather_name: '',
  father_name_ne: '',
  grandfather_name_ne: '',
  spouse_name: '',
  children: '[]',
  in_laws_mother: '',
  in_laws_father: '',
  temp_province: '',
  temp_district: '',
  temp_municipality: '',
  temp_ward: '',
  temp_tole: '',
  perm_province: '',
  perm_district: '',
  perm_municipality: '',
  perm_ward: '',
  perm_tole: '',
  cit_zone: '',
  cit_district: '',
  cit_municipality: '',
  cit_ward: '',
  cit_tole: '',
  citizenship_no: '',
  citizenship_district: '',
  citizenship_issue_date: '',
  email: '',
  pan_no: '',
  nid_no: '',
  demat_no: '',
  phone_number: '',
  bank_name: '',
  branch_name: '',
  account_no: '',
  nominee_name: '',
  nominee_name_ne: '',
  nominee_relation: '',
};

export default function ShareholdersPage() {
  const supabase = createClient();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editing, setEditing] = useState<Shareholder | null>(null);
  const [viewing, setViewing] = useState<Shareholder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [citizenshipPhoto, setCitizenshipPhoto] = useState<File | null>(null);
  const [nidPhoto, setNidPhoto] = useState<File | null>(null);
  const [nomineeCitizenship, setNomineeCitizenship] = useState<File | null>(null);
  const [nomineeProfile, setNomineeProfile] = useState<File | null>(null);
  const [shareForm, setShareForm] = useState<File | null>(null);

  // Filter state
  const [filterKyc, setFilterKyc] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMissing, setFilterMissing] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingShareholder, setDeletingShareholder] = useState<Shareholder | null>(null);

  // Sorting state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export functionality
  const handleExport = () => {
    try {
      if (filtered.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = [
        'Member ID', 'First Name', 'Middle Name', 'Last Name',
        'Phone', 'Email', 'District', 'Citizenship No',
        'Citizenship District', 'Citizenship Issue Date (AD)',
        'Citizenship Issue Date (BS)', 'KYC Status', 'Member Since'
      ];

      const csvContent = [
        headers.join(','),
        ...filtered.map(sh => [
          sh.member_id,
          sh.first_name,
          sh.middle_name || '',
          sh.last_name,
          sh.phone_number || '',
          sh.email || '',
          sh.perm_address?.district || '',
          sh.citizenship_no,
          sh.citizenship_district,
          sh.citizenship_issue_date,
          adToBs(sh.citizenship_issue_date),
          sh.kyc_status,
          sh.member_since
        ].map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `shareholders_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export data');
    }
  };

  const fetchShareholders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shareholders')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }); // Fetch earliest first to determine ID

    if (error) {
      toast.error('Failed to load shareholders');
      console.error(error);
    } else {
      // Calculate member IDs (1, 2, 3...) based on joining timestamp
      const members = (data || []).map((sh, idx) => ({ ...sh, member_id: idx + 1 })) as Shareholder[];
      
      // Apply sort order
      if (sortOrder === 'asc') {
        setShareholders(members);
      } else {
        setShareholders([...members].reverse());
      }
    }
    setLoading(false);
  }, [supabase, sortOrder]);

  useEffect(() => {
    fetchShareholders();
  }, [fetchShareholders]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const missing = params.get('missing');
      const district = params.get('district');
      
      if (missing) {
        setFilterMissing(missing);
        setShowFilters(true);
      }
      if (district) {
        setFilterDistrict(district);
        setShowFilters(true);
      }
    }
  }, []);


  const uploadDoc = async (file: File, bucket: string, prefix: string, label?: string) => {
    try {
      const isImage = file.type.startsWith('image/');
      let finalFile: File | Blob = file;
      
      if (isImage) {
        const processedFile = await processImage(file);
        finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
          ? new File([processedFile], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
          : processedFile as File;
      }

      const ext = (finalFile instanceof File ? finalFile.name : file.name).split('.').pop();
      const filePath = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, finalFile);

      if (uploadErr) {
        console.error(`Storage error (${bucket}):`, uploadErr);
        toast.error(`Upload failed for ${label || bucket}: ${uploadErr.message}`);
        return null;
      }

      // Since the bucket is public (as seen in dashboard), get the public URL directly
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error(`Upload error: ${err.message}`);
      return null;
    }
  };

  useEffect(() => {
    if (shareholders.length > 0 && !startDate && !endDate) {
      setStartDate(shareholders[0].member_since); // Most recent join date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [shareholders, startDate, endDate]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const autoTransliterate = async (englishText: string, targetField: string) => {
    if (!englishText || !englishText.trim()) return;
    try {
      const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(englishText)}&itc=ne-t-i0-und&num=1`);
      const data = await res.json();
      if (data[0] === 'SUCCESS') {
        const translatedText = data[1][0][1][0];
        setForm(prev => ({ 
          ...prev, 
          [targetField]: prev[targetField as keyof typeof prev] === '' ? translatedText : prev[targetField as keyof typeof prev] 
        }));
      }
    } catch (err) {
      console.error('Transliteration failed:', err);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setProfilePic(null);
    setCitizenshipPhoto(null);
    setNidPhoto(null);
    setNomineeCitizenship(null);
    setNomineeProfile(null);
    setShareForm(null);
    setActiveTab(0);
    setShowModal(true);
  };

  const openEdit = (sh: Shareholder) => {
    setEditing(sh);
    setForm({
      first_name: sh.first_name,
      middle_name: sh.middle_name || '',
      last_name: sh.last_name,
      first_name_ne: sh.first_name_ne || '',
      middle_name_ne: sh.middle_name_ne || '',
      last_name_ne: sh.last_name_ne || '',
      father_name: sh.father_name || '',
      grandfather_name: sh.grandfather_name || '',
      father_name_ne: sh.father_name_ne || '',
      grandfather_name_ne: sh.grandfather_name_ne || '',
      spouse_name: sh.spouse_name || '',
      children: JSON.stringify(sh.children || []),
      in_laws_mother: sh.in_laws?.mother_in_law || '',
      in_laws_father: sh.in_laws?.father_in_law || '',
      temp_province: sh.temp_address?.province || '',
      temp_district: sh.temp_address?.district || '',
      temp_municipality: sh.temp_address?.municipality || '',
      temp_ward: sh.temp_address?.ward || '',
      temp_tole: sh.temp_address?.tole || '',
      perm_province: sh.perm_address?.province || '',
      perm_district: sh.perm_address?.district || '',
      perm_municipality: sh.perm_address?.municipality || '',
      perm_ward: sh.perm_address?.ward || '',
      perm_tole: sh.perm_address?.tole || '',
      cit_zone: sh.cit_address?.zone || '',
      cit_district: sh.cit_address?.district || '',
      cit_municipality: sh.cit_address?.municipality || '',
      cit_ward: sh.cit_address?.ward || '',
      cit_tole: sh.cit_address?.tole || '',
      citizenship_no: sh.citizenship_no,
      citizenship_district: sh.citizenship_district,
      citizenship_issue_date: sh.citizenship_issue_date,
      email: sh.email || '',
      pan_no: sh.pan_no || '',
      nid_no: sh.nid_no || '',
      demat_no: sh.demat_no || '',
      phone_number: sh.phone_number || '',
      bank_name: sh.bank_details?.[0]?.bank_name || '',
      branch_name: sh.bank_details?.[0]?.branch_name || '',
      account_no: sh.bank_details?.[0]?.account_no || '',
      nominee_name: sh.nominee_name || '',
      nominee_name_ne: sh.nominee_name_ne || '',
      nominee_relation: sh.nominee_relation || '',
    });
    setProfilePic(null);
    setCitizenshipPhoto(null);
    setNidPhoto(null);
    setNomineeCitizenship(null);
    setNomineeProfile(null);
    setShareForm(null);
    setActiveTab(0);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const loadingToast = toast.loading('Saving shareholder data...');

    try {
      let profilePicUrl = editing?.profile_pic_url || null;
      let citizenshipPhotoUrl = editing?.citizenship_photo_url || null;
      let nidPhotoUrl = editing?.nid_photo_url || null;
      let nomineeCitizenshipUrl = editing?.nominee_citizenship_url || null;
      let nomineeProfilePicUrl = editing?.nominee_profile_pic_url || null;
      let shareFormUrl = editing?.share_form_url || null;

      if (profilePic) profilePicUrl = await uploadDoc(profilePic, 'profile-pictures', 'shareholders', 'Profile Picture');
      if (citizenshipPhoto) citizenshipPhotoUrl = await uploadDoc(citizenshipPhoto, 'shareholder-documents', 'citizenship', 'Citizenship Photo');
      if (nidPhoto) nidPhotoUrl = await uploadDoc(nidPhoto, 'shareholder-documents', 'nid', 'NID Photo');
      if (nomineeCitizenship) nomineeCitizenshipUrl = await uploadDoc(nomineeCitizenship, 'shareholder-documents', 'nominee-cit', 'Nominee Citizenship');
      if (nomineeProfile) nomineeProfilePicUrl = await uploadDoc(nomineeProfile, 'shareholder-documents', 'nominee-prof', 'Nominee Profile');
      if (shareForm) shareFormUrl = await uploadDoc(shareForm, 'shareholder-documents', 'share-forms', 'Share Form');

      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        first_name_ne: form.first_name_ne || null,
        middle_name_ne: form.middle_name_ne || null,
        last_name_ne: form.last_name_ne || null,
        father_name: form.father_name || null,
        grandfather_name: form.grandfather_name || null,
        father_name_ne: form.father_name_ne || null,
        grandfather_name_ne: form.grandfather_name_ne || null,
        spouse_name: form.spouse_name || null,
        children: JSON.parse(form.children || '[]'),
        in_laws: {
          mother_in_law: form.in_laws_mother || '',
          father_in_law: form.in_laws_father || '',
        },
        temp_address: form.temp_province
          ? {
              province: form.temp_province,
              district: form.temp_district,
              municipality: form.temp_municipality,
              ward: form.temp_ward,
              tole: form.temp_tole,
            }
          : null,
        perm_address: {
          province: form.perm_province,
          district: form.perm_district,
          municipality: form.perm_municipality,
          ward: form.perm_ward,
          tole: form.perm_tole,
        },
        cit_address: form.cit_zone ? {
          zone: form.cit_zone,
          district: form.cit_district,
          municipality: form.cit_municipality,
          ward: form.cit_ward,
          tole: form.cit_tole,
        } : null,
        citizenship_no: form.citizenship_no,
        citizenship_district: form.citizenship_district,
        citizenship_issue_date: form.citizenship_issue_date,
        email: form.email || null,
        pan_no: form.pan_no || null,
        nid_no: form.nid_no || null,
        demat_no: form.demat_no || null,
        phone_number: form.phone_number || null,
        bank_details: [
          {
            bank_name: form.bank_name,
            branch_name: form.branch_name,
            account_no: form.account_no,
          },
        ],
        profile_pic_url: profilePicUrl,
        citizenship_photo_url: citizenshipPhotoUrl,
        nid_photo_url: nidPhotoUrl,
        nominee_citizenship_url: nomineeCitizenshipUrl,
        nominee_profile_pic_url: nomineeProfilePicUrl,
        nominee_name: form.nominee_name || null,
        nominee_name_ne: form.nominee_name_ne || null,
        nominee_relation: form.nominee_relation || null,
        share_form_url: shareFormUrl,
        created_by: user?.id || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('shareholders')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;
        toast.success('Shareholder updated successfully');
      } else {
        const fullPayload = {
          ...payload,
          member_since: new Date().toISOString().split('T')[0],
          kyc_status: 'pending'
        };
        const { error } = await supabase.from('shareholders').insert(fullPayload);
        if (error) throw error;
        toast.success('Shareholder created successfully');
      }

      setShowModal(false);
      fetchShareholders();
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      toast.dismiss(loadingToast);
      setSaving(false);
    }
  };

  const handleDelete = (sh: Shareholder) => {
    setDeletingShareholder(sh);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingShareholder) return;
    setSaving(true);

    const { error } = await supabase
      .from('shareholders')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', deletingShareholder.id);

    if (error) {
      toast.error('Failed to delete shareholder');
    } else {
      toast.success('Shareholder moved to recycle bin');
      fetchShareholders();
      setShowDeleteModal(false);
      setDeletingShareholder(null);
    }
    setSaving(false);
  };

  const handleKycAction = async (sh: Shareholder, status: 'verified' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('shareholders')
      .update({
        kyc_status: status,
        kyc_verified_at: new Date().toISOString(),
        kyc_verified_by: user?.id,
      })
      .eq('id', sh.id);

    if (error) {
      toast.error('Failed to update KYC status');
    } else {
      toast.success(`KYC marked as ${status}`);
      fetchShareholders();
      setShowViewModal(false);
    }
  };

  const filtered = shareholders.filter(sh => {
    const s = search.toLowerCase();
    const d = sh.member_since;
    const matchesSearch = sh.first_name.toLowerCase().includes(s) ||
                         (sh.middle_name || '').toLowerCase().includes(s) ||
                         sh.last_name.toLowerCase().includes(s) ||
                         (sh.phone_number || '').includes(s) ||
                         (sh.citizenship_no || '').includes(s) ||
                         sh.id.toLowerCase().includes(s);
    
    const matchesDistrict = filterDistrict === 'all' || sh.perm_address?.district === filterDistrict;
    const matchesKyc = filterKyc === 'all' || sh.kyc_status === filterKyc;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? sh.is_active : !sh.is_active);
    const matchesMissing = filterMissing === 'all' || 
                           (filterMissing === 'email' && (!sh.email || sh.email.trim() === '')) ||
                           (filterMissing === 'pan' && (!sh.pan_no || sh.pan_no.trim() === '')) ||
                           (filterMissing === 'nid' && (!sh.nid_no || sh.nid_no.trim() === ''));
    
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;

    return matchesSearch && matchesDistrict && matchesKyc && matchesStatus && matchesMissing;
  });

  // Get unique districts for filter dropdown
  const uniqueDistricts = [...new Set(shareholders.map(sh => sh.perm_address?.district).filter(Boolean))] as string[];
  const activeFilterCount = [filterKyc, filterDistrict, filterStatus, filterMissing].filter(f => f !== 'all').length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('ID copied to clipboard');
  };

  const kycIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={14} />;
      case 'rejected':
        return <XCircle size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  const kycBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return 'badge-success';
      case 'rejected':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  };

  const tabs = ['Personal Info', 'Family & Address', 'Identity & Banking', 'Documents'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shareholders</h1>
          <p className="page-subtitle">{filtered.length} shareholders &bull; Tracking share ownership</p>
          <div className="print-period">
            Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/shareholders/lagat" className="btn btn-secondary no-print">
            <FileText size={16} /> View Lagat
          </Link>
          <Link href="/dashboard/shareholders/import" className="btn btn-secondary no-print">
            <Upload size={16} /> Bulk Import
          </Link>
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary no-print" onClick={openCreate} id="add-shareholder-btn">
            <Plus size={16} /> Add Shareholder
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Search & Filters */}
        <div className="search-bar" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ maxWidth: 400, flex: 1, minWidth: 250 }}>
            <Search size={16} />
            <input
              className="input"
              placeholder="Search by name, ID, phone, citizenship no, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 42 }}
            />
          </div>
          <div className="flex items-center gap-2">
             <label className="text-sm text-muted">From (Join):</label>
             <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
          </div>
          <div className="flex items-center gap-2">
             <label className="text-sm text-muted">To:</label>
             <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
            style={{ position: 'relative' }}
          >
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--primary)', color: '#fff',
                width: 18, height: 18, borderRadius: '50%',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{activeFilterCount}</span>
            )}
          </button>
          <button className="btn btn-secondary" onClick={handleExport} title="Export filtered list to CSV">
            <Download size={16} />
            Export
          </button>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 16px',
            background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 16,
            border: '1px solid var(--border)',
          }}>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>KYC Status</label>
              <select className="select" value={filterKyc} onChange={(e) => setFilterKyc(e.target.value)} style={{ fontSize: 13 }}>
                <option value="all">All</option>
                <option value="verified">✅ Verified</option>
                <option value="pending">⏳ Pending</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>District</label>
              <select className="select" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} style={{ fontSize: 13 }}>
                <option value="all">All Districts</option>
                {uniqueDistricts.sort().map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Status</label>
              <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: 13 }}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Missing Info</label>
              <select className="select" value={filterMissing} onChange={(e) => setFilterMissing(e.target.value)} style={{ fontSize: 13 }}>
                <option value="all">All</option>
                <option value="email">Missing Email</option>
                <option value="pan">Missing PAN</option>
                <option value="nid">Missing NID</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setFilterKyc('all'); setFilterDistrict('all'); setFilterStatus('all'); setFilterMissing('all'); }} style={{ color: 'var(--danger)', fontSize: 12 }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4" style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div className="skeleton" style={{ width: 200, height: 16 }} />
                <div className="skeleton" style={{ width: 120, height: 16, marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <Users size={48} />
            <h3>No shareholders found</h3>
            <p>Add your first shareholder to get started.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}>
              <Plus size={16} />
              Add Shareholder
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by ID"
                  >
                    <div className="flex items-center gap-1">
                      ID
                      <span style={{ fontSize: 10, opacity: 0.5 }}>
                        {sortOrder === 'asc' ? '▲' : '▼'}
                      </span>
                    </div>
                  </th>
                  <th>District</th>
                  <th>Citizenship No</th>
                  <th>KYC</th>
                  <th>Member Since</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sh) => (
                  <tr key={sh.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="sidebar-user-avatar"
                          style={{
                            width: 36,
                            height: 36,
                            fontSize: 13,
                            backgroundImage: sh.profile_pic_url
                              ? `url(${sh.profile_pic_url})`
                              : undefined,
                            backgroundSize: 'cover',
                          }}
                        >
                          {!sh.profile_pic_url && `${sh.first_name[0]}${sh.last_name[0]}`}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {sh.first_name} {sh.middle_name ? sh.middle_name + ' ' : ''}{sh.last_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {sh.perm_address?.district || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }} title={sh.id}>
                          {sh.member_id}
                        </span>
                        <button className="btn btn-ghost btn-icon" onClick={() => copyToClipboard(String(sh.member_id))} title="Copy ID" style={{ padding: 2, minWidth: 'unset', marginLeft: 6 }}>
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{sh.perm_address?.district || '—'}</span>
                    </td>
                    <td>{sh.citizenship_no}</td>
                    <td>
                      <span className={`badge ${kycBadge(sh.kyc_status)} flex items-center gap-2`}>
                        {kycIcon(sh.kyc_status)}
                        {sh.kyc_status}
                      </span>
                    </td>
                    <td>{adToBs(sh.member_since)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => { setViewing(sh); setShowViewModal(true); }}
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => openEdit(sh)}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleDelete(sh)}
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                        >
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

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editing ? 'Edit Shareholder' : 'Add New Shareholder'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Tabs */}
              <div className="tabs" style={{ padding: '0 24px' }}>
                {tabs.map((tab, i) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tab ${activeTab === i ? 'active' : ''}`}
                    onClick={() => setActiveTab(i)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="modal-body">
                {/* Tab 0: Personal Info */}
                {activeTab === 0 && (
                  <>
                    {/* Profile Picture */}
                    <div className="input-group mb-4">
                      <label>Profile Picture</label>
                      <div className="flex items-center gap-3">
                        <div
                          className="sidebar-user-avatar"
                          style={{
                            width: 56,
                            height: 56,
                            fontSize: 18,
                            backgroundImage: profilePic
                              ? `url(${URL.createObjectURL(profilePic)})`
                              : editing?.profile_pic_url
                              ? `url(${editing.profile_pic_url})`
                              : undefined,
                            backgroundSize: 'cover',
                          }}
                        >
                          {!profilePic && !editing?.profile_pic_url && (
                            <Upload size={20} />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setProfilePic(e.target.files?.[0] || null)}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="input-group">
                        <label>First Name <span className="required">*</span></label>
                        <input
                          className="input"
                          value={form.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          onBlur={(e) => autoTransliterate(e.target.value, 'first_name_ne')}
                          required
                          placeholder="First name"
                        />
                      </div>
                      <div className="input-group">
                        <label>First Name (Nepali)</label>
                        <input
                          className="input"
                          value={form.first_name_ne}
                          onChange={(e) => handleInputChange('first_name_ne', e.target.value)}
                          placeholder="नेपालीमा नाम"
                        />
                      </div>
                      <div className="input-group">
                        <label>Middle Name</label>
                        <input
                          className="input"
                          value={form.middle_name}
                          onChange={(e) => handleInputChange('middle_name', e.target.value)}
                          onBlur={(e) => autoTransliterate(e.target.value, 'middle_name_ne')}
                          placeholder="Middle name"
                        />
                      </div>
                      <div className="input-group">
                        <label>Middle Name (Nepali)</label>
                        <input
                          className="input"
                          value={form.middle_name_ne}
                          onChange={(e) => handleInputChange('middle_name_ne', e.target.value)}
                          placeholder="Middle name in Nepali"
                        />
                      </div>
                      <div className="input-group">
                        <label>Last Name <span className="required">*</span></label>
                        <input
                          className="input"
                          value={form.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          onBlur={(e) => autoTransliterate(e.target.value, 'last_name_ne')}
                          required
                          placeholder="Last name"
                        />
                      </div>
                      <div className="input-group">
                        <label>Last Name (Nepali)</label>
                        <input
                          className="input"
                          value={form.last_name_ne}
                          onChange={(e) => handleInputChange('last_name_ne', e.target.value)}
                          placeholder="नेपालीमा थर"
                        />
                      </div>
                      <div className="input-group">
                        <label>Father&apos;s Name</label>
                        <input 
                          className="input" 
                          value={form.father_name} 
                          onChange={(e) => handleInputChange('father_name', e.target.value)} 
                          onBlur={(e) => autoTransliterate(e.target.value, 'father_name_ne')}
                          placeholder="Father's name" 
                        />
                      </div>
                      <div className="input-group">
                        <label>Father&apos;s Name (Nepali)</label>
                        <input className="input" value={form.father_name_ne} onChange={(e) => handleInputChange('father_name_ne', e.target.value)} placeholder="Father's name in Nepali" />
                      </div>
                      <div className="input-group">
                        <label>Grandfather&apos;s Name</label>
                        <input 
                          className="input" 
                          value={form.grandfather_name} 
                          onChange={(e) => handleInputChange('grandfather_name', e.target.value)} 
                          onBlur={(e) => autoTransliterate(e.target.value, 'grandfather_name_ne')}
                          placeholder="Grandfather's name" 
                        />
                      </div>
                      <div className="input-group">
                        <label>Grandfather&apos;s Name (Nepali)</label>
                        <input className="input" value={form.grandfather_name_ne} onChange={(e) => handleInputChange('grandfather_name_ne', e.target.value)} placeholder="Grandfather's name in Nepali" />
                      </div>
                      <div className="input-group">
                        <label>Spouse Name</label>
                        <input className="input" value={form.spouse_name} onChange={(e) => handleInputChange('spouse_name', e.target.value)} placeholder="Spouse name" />
                      </div>
                      <div className="input-group">
                        <label>Phone Number</label>
                        <input
                          className="input"
                          value={form.phone_number}
                          onChange={(e) => handleInputChange('phone_number', e.target.value)}
                          placeholder="Phone number"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 1: Family & Address */}
                {activeTab === 1 && (
                  <>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Family (if married)</h3>
                    <div className="form-grid mb-6">
                      <div className="input-group">
                        <label>Mother-in-Law</label>
                        <input className="input" value={form.in_laws_mother} onChange={(e) => handleInputChange('in_laws_mother', e.target.value)} placeholder="Mother-in-law name" />
                      </div>
                      <div className="input-group">
                        <label>Father-in-Law</label>
                        <input className="input" value={form.in_laws_father} onChange={(e) => handleInputChange('in_laws_father', e.target.value)} placeholder="Father-in-law name" />
                      </div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Permanent Address (as per Province) <span className="required">*</span></h3>
                    <div className="form-grid mb-6">
                      <div className="input-group">
                        <label>Province <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.perm_province} 
                          onChange={(e) => setForm(p => ({ ...p, perm_province: e.target.value, perm_district: '', perm_municipality: '', perm_ward: '' }))} 
                          required
                        >
                          <option value="">Select Province</option>
                          {nepalData.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>District <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.perm_district} 
                          onChange={(e) => setForm(p => ({ ...p, perm_district: e.target.value, perm_municipality: '', perm_ward: '' }))} 
                          required
                          disabled={!form.perm_province}
                        >
                          <option value="">Select District</option>
                          {normalize(nepalData.find((p: any) => p.name === form.perm_province)?.districts).map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Municipality/VDC <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.perm_municipality} 
                          onChange={(e) => setForm(p => ({ ...p, perm_municipality: e.target.value, perm_ward: '' }))} 
                          required
                          disabled={!form.perm_district}
                        >
                          <option value="">Select Municipality</option>
                          {normalize(normalize(nepalData.find((p: any) => p.name === form.perm_province)?.districts).find((d: any) => d.name === form.perm_district)?.municipalities).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Ward No. <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.perm_ward} 
                          onChange={(e) => handleInputChange('perm_ward', e.target.value)} 
                          required
                          disabled={!form.perm_municipality}
                        >
                          <option value="">Select Ward</option>
                          {normalize(normalize(nepalData.find((p: any) => p.name === form.perm_province)?.districts).find((d: any) => d.name === form.perm_district)?.municipalities).find((c: any) => c.name === form.perm_municipality)?.wards?.map((w: any) => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="input-group"><label>Tole <span className="required">*</span></label><input className="input" value={form.perm_tole} onChange={(e) => handleInputChange('perm_tole', e.target.value)} required placeholder="Tole/Street" /></div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Permanent Address (as per Citizenship) </h3>
                    <div className="form-grid mb-6">
                      <div className="input-group">
                        <label>Zone </label>
                        <select 
                          className="select" 
                          value={form.cit_zone} 
                          onChange={(e) => setForm(p => ({ ...p, cit_zone: e.target.value, cit_district: '', cit_municipality: '', cit_ward: '' }))}
                        >
                          <option value="">Select Zone</option>
                          {NEPAL_ZONES.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>District </label>
                        <select 
                          className="select" 
                          value={form.cit_district} 
                          onChange={(e) => setForm(p => ({ ...p, cit_district: e.target.value, cit_municipality: '', cit_ward: '' }))}
                          disabled={!form.cit_zone}
                        >
                          <option value="">Select District</option>
                          {NEPAL_ZONES.find(z => z.name === form.cit_zone)?.districts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Municipality/VDC </label>
                        <div className="relative group">
                          <input 
                            className="input" 
                            list="cit-municipalities"
                            value={form.cit_municipality} 
                            onChange={(e) => setForm(p => ({ ...p, cit_municipality: e.target.value, cit_ward: '' }))}
                            placeholder="Type or select Municipality/VDC"
                            disabled={!form.cit_district}
                          />
                          <datalist id="cit-municipalities">
                            {normalize(nepalData.flatMap((p: any) => normalize(p.districts)).find((d: any) => d.name === form.cit_district)?.municipalities).map((c: any) => (
                              <option key={c.id} value={c.name} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>Ward No.</label>
                        <input 
                          className="input" 
                          list="cit-wards"
                          value={form.cit_ward} 
                          onChange={(e) => handleInputChange('cit_ward', e.target.value)}
                          placeholder="Type or select Ward"
                          disabled={!form.cit_municipality}
                        />
                        <datalist id="cit-wards">
                          {normalize(nepalData.flatMap((p: any) => normalize(p.districts)).find((d: any) => d.name === form.cit_district)?.municipalities).find((c: any) => c.name === form.cit_municipality)?.wards?.map((w: any) => (
                            <option key={w} value={w} />
                          ))}
                        </datalist>
                      </div>
                      <div className="input-group"><label>Tole</label><input className="input" value={form.cit_tole} onChange={(e) => handleInputChange('cit_tole', e.target.value)} placeholder="Tole/Street" /></div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Temporary Address</h3>
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Province</label>
                        <select 
                          className="select" 
                          value={form.temp_province} 
                          onChange={(e) => setForm(p => ({ ...p, temp_province: e.target.value, temp_district: '', temp_municipality: '', temp_ward: '' }))}
                        >
                          <option value="">Select Province</option>
                          {nepalData.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>District</label>
                        <select 
                          className="select" 
                          value={form.temp_district} 
                          onChange={(e) => setForm(p => ({ ...p, temp_district: e.target.value, temp_municipality: '', temp_ward: '' }))}
                          disabled={!form.temp_province}
                        >
                          <option value="">Select District</option>
                          {normalize(nepalData.find((p: any) => p.name === form.temp_province)?.districts).map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Municipality/VDC</label>
                        <select 
                          className="select" 
                          value={form.temp_municipality} 
                          onChange={(e) => setForm(p => ({ ...p, temp_municipality: e.target.value, temp_ward: '' }))}
                          disabled={!form.temp_district}
                        >
                          <option value="">Select Municipality</option>
                          {normalize(normalize(nepalData.find((p: any) => p.name === form.temp_province)?.districts).find((d: any) => d.name === form.temp_district)?.municipalities).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Ward No.</label>
                        <select 
                          className="select" 
                          value={form.temp_ward} 
                          onChange={(e) => handleInputChange('temp_ward', e.target.value)}
                          disabled={!form.temp_municipality}
                        >
                          <option value="">Select Ward</option>
                          {normalize(normalize(nepalData.find((p: any) => p.name === form.temp_province)?.districts).find((d: any) => d.name === form.temp_district)?.municipalities).find((c: any) => c.name === form.temp_municipality)?.wards?.map((w: any) => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="input-group"><label>Tole</label><input className="input" value={form.temp_tole} onChange={(e) => handleInputChange('temp_tole', e.target.value)} placeholder="Tole/Street" /></div>
                    </div>
                  </>
                )}

                {/* Tab 2: Identity & Banking */}
                {activeTab === 2 && (
                  <>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Citizenship Details <span className="required">*</span></h3>
                    <div className="form-grid mb-6">
                      <div className="input-group"><label>Citizenship No <span className="required">*</span></label><input className="input" value={form.citizenship_no} onChange={(e) => handleInputChange('citizenship_no', e.target.value)} required placeholder="e.g., 123-456-78901" /></div>
                      <div className="input-group">
                        <label>Issue District <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.citizenship_district} 
                          onChange={(e) => handleInputChange('citizenship_district', e.target.value)} 
                          required
                        >
                          <option value="">Select District</option>
                          {nepalData.flatMap((p: any) => normalize(p.districts)).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Issue Date (BS) <span className="required">*</span></label>
                        <NepaliDateInput 
                          value={form.citizenship_issue_date} 
                          onChange={(adDate) => handleInputChange('citizenship_issue_date', adDate)} 
                          required 
                        />
                      </div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Other IDs</h3>
                    <div className="form-grid mb-6">
                      <div className="input-group"><label>Email</label><input type="email" className="input" value={form.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="email@example.com" /></div>
                      <div className="input-group"><label>PAN Number</label><input className="input" value={form.pan_no} onChange={(e) => handleInputChange('pan_no', e.target.value)} placeholder="PAN number" /></div>
                      <div className="input-group"><label>NID Number</label><input className="input" value={form.nid_no} onChange={(e) => handleInputChange('nid_no', e.target.value)} placeholder="NID number" /></div>
                      <div className="input-group"><label>DEMAT Number</label><input className="input" value={form.demat_no} onChange={(e) => handleInputChange('demat_no', e.target.value)} placeholder="DEMAT account no" /></div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Bank Details <span className="required">*</span></h3>
                    <div className="form-grid">
                      <div className="input-group"><label>Bank Name <span className="required">*</span></label><input className="input" value={form.bank_name} onChange={(e) => handleInputChange('bank_name', e.target.value)} required placeholder="e.g., NIC Asia Bank" /></div>
                      <div className="input-group"><label>Branch Name <span className="required">*</span></label><input className="input" value={form.branch_name} onChange={(e) => handleInputChange('branch_name', e.target.value)} required placeholder="e.g., Pokhara Branch" /></div>
                      <div className="input-group"><label>Account Number <span className="required">*</span></label><input className="input" value={form.account_no} onChange={(e) => handleInputChange('account_no', e.target.value)} required placeholder="Account number" /></div>
                    </div>
                  </>
                )}

                {/* Tab 3: Documents & Nominee */}
                {activeTab === 3 && (
                  <>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Nominee Details</h3>
                    <div className="form-grid mb-6">
                      <div className="input-group">
                        <label>Nominee Name</label>
                        <input
                          className="input"
                          value={form.nominee_name}
                          onChange={(e) => handleInputChange('nominee_name', e.target.value)}
                          onBlur={(e) => autoTransliterate(e.target.value, 'nominee_name_ne')}
                          placeholder="Nominee name"
                        />
                      </div>
                      <div className="input-group">
                        <label>Nominee Name (Nepali)</label>
                        <input
                          className="input"
                          value={form.nominee_name_ne}
                          onChange={(e) => handleInputChange('nominee_name_ne', e.target.value)}
                          placeholder="नेपालीमा नाम"
                        />
                      </div>
                      <div className="input-group"><label>Nominee Relation</label><input className="input" value={form.nominee_relation} onChange={(e) => handleInputChange('nominee_relation', e.target.value)} placeholder="e.g., Son, Spouse" /></div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Shared Documents</h3>
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Citizenship Photo</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setCitizenshipPhoto(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                        <PreviewItem file={citizenshipPhoto} url={editing?.citizenship_photo_url || null} label="Citizenship" />
                      </div>
                      <div className="input-group">
                        <label>NID Photo</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setNidPhoto(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                        <PreviewItem file={nidPhoto} url={editing?.nid_photo_url || null} label="NID" />
                      </div>
                      <div className="input-group">
                        <label>Nominee Citizenship</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setNomineeCitizenship(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                        <PreviewItem file={nomineeCitizenship} url={editing?.nominee_citizenship_url || null} label="Nominee Cit." />
                      </div>
                      <div className="input-group">
                        <label>Nominee Profile Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => setNomineeProfile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                        <PreviewItem file={nomineeProfile} url={editing?.nominee_profile_pic_url || null} label="Nominee Photo" />
                      </div>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Share Form (if physical)</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setShareForm(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                        <PreviewItem file={shareForm} url={editing?.share_form_url || null} label="Share Form" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                {activeTab > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveTab(activeTab - 1)}>
                    Previous
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                {activeTab < tabs.length - 1 ? (
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab(activeTab + 1)}>
                    Next
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {showViewModal && viewing && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {viewing.first_name} {viewing.middle_name ? viewing.middle_name + ' ' : ''}{viewing.last_name}
              </h2>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-icon" onClick={() => setShowViewModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ gap: 24 }}>
                {/* Left column */}
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className="sidebar-user-avatar"
                      style={{
                        width: 64,
                        height: 64,
                        fontSize: 22,
                        backgroundImage: viewing.profile_pic_url ? `url(${viewing.profile_pic_url})` : undefined,
                        backgroundSize: 'cover',
                      }}
                    >
                      {!viewing.profile_pic_url && `${viewing.first_name[0]}${viewing.last_name[0]}`}
                    </div>
                    <div>
                      <span className={`badge ${kycBadge(viewing.kyc_status)} flex items-center gap-2`} style={{ marginBottom: 4 }}>
                        {kycIcon(viewing.kyc_status)}
                        KYC: {viewing.kyc_status}
                      </span>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Member since {adToBs(viewing.member_since)} BS ({viewing.member_since})
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <DetailRow label="Father" value={viewing.father_name} />
                    <DetailRow label="Grandfather" value={viewing.grandfather_name} />
                    <DetailRow label="Spouse" value={viewing.spouse_name} />
                    <DetailRow label="Phone" value={viewing.phone_number} />
                    <DetailRow label="Citizenship" value={`${viewing.citizenship_no} (${viewing.citizenship_district})`} />
                    <DetailRow label="Email" value={viewing.email} />
                    <DetailRow label="PAN" value={viewing.pan_no} />
                    <DetailRow label="NID" value={viewing.nid_no} />
                    <DetailRow label="DEMAT" value={viewing.demat_no} />
                    <DetailRow label="Issue Date" value={`${adToBs(viewing.citizenship_issue_date)} BS (${viewing.citizenship_issue_date})`} />
                  </div>
                  
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 20, marginBottom: 12, color: 'var(--text-primary)' }}>Uploaded Documents</h4>
                  <div className="flex flex-col gap-3">
                    {viewing.citizenship_photo_url && (
                      <DocumentPreview url={viewing.citizenship_photo_url} label="Citizenship Photo" />
                    )}
                    {viewing.nid_photo_url && (
                      <DocumentPreview url={viewing.nid_photo_url} label="NID Photo" />
                    )}
                    {viewing.nominee_citizenship_url && (
                      <DocumentPreview url={viewing.nominee_citizenship_url} label="Nominee Citizenship" />
                    )}
                    {viewing.share_form_url && (
                      <DocumentPreview url={viewing.share_form_url} label="Share Form" />
                    )}
                    {!viewing.citizenship_photo_url && !viewing.nid_photo_url && !viewing.share_form_url && !viewing.nominee_citizenship_url && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No documents uploaded</span>
                    )}
                  </div>
                </div>

                {/* Right column */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Permanent Address</h4>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    {[viewing.perm_address?.tole, `Ward ${viewing.perm_address?.ward}`, viewing.perm_address?.municipality, viewing.perm_address?.district, viewing.perm_address?.province]
                      .filter(Boolean)
                      .join(', ')}
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Bank Details</h4>
                  {viewing.bank_details?.map((b, i) => (
                    <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {b.bank_name} — {b.branch_name} ({b.account_no})
                    </div>
                  ))}

                  <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 12 }}>Nominee Info</h4>
                  <div className="flex items-start gap-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div
                      className="sidebar-user-avatar"
                      style={{
                        width: 48,
                        height: 48,
                        fontSize: 16,
                        backgroundImage: viewing.nominee_profile_pic_url ? `url(${viewing.nominee_profile_pic_url})` : undefined,
                        backgroundSize: 'cover',
                        flexShrink: 0
                      }}
                    >
                      {!viewing.nominee_profile_pic_url && viewing.nominee_name?.[0]}
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{viewing.nominee_name || 'No nominee'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{viewing.nominee_relation ? `Relation: ${viewing.nominee_relation}` : 'Relation not specified'}</div>
                    </div>
                  </div>

                  {/* KYC Actions */}
                  {viewing.kyc_status === 'pending' && (
                    <div className="mt-6">
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>KYC Actions</h4>
                      <div className="flex gap-3">
                        <button className="btn btn-primary btn-sm" onClick={() => handleKycAction(viewing, 'verified')}>
                          <CheckCircle size={14} /> Verify KYC
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleKycAction(viewing, 'rejected')}>
                          <XCircle size={14} /> Reject KYC
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingShareholder && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to soft-delete this shareholder? They will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Name:</strong> {deletingShareholder.first_name} {deletingShareholder.last_name}</div>
                <div style={{ marginBottom: 4 }}><strong>ID:</strong> {deletingShareholder.id}</div>
                <div><strong>Citizenship:</strong> {deletingShareholder.citizenship_no}</div>
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
        }
        .print-period { display: none; }
      `}</style>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 14 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}

function PreviewItem({ file, url, label }: { file: File | null; url: string | null; label: string }) {
  const isPDF = (file?.type === 'application/pdf') || (url?.toLowerCase().endsWith('.pdf') || url?.includes('.pdf?'));
  const previewUrl = file ? URL.createObjectURL(file) : url;

  if (!previewUrl) return null;

  return (
    <div 
      className="preview-box" 
      onClick={() => window.open(previewUrl, '_blank')} 
      style={{ 
        marginTop: 8, 
        cursor: 'pointer',
        padding: '6px',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}
    >
      {isPDF ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 12 }}>
          <FileText size={16} /> <span>View PDF</span>
        </div>
      ) : (
        <img src={previewUrl} alt={label} style={{ maxHeight: 40, width: 40, objectFit: 'cover', borderRadius: 4 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{file ? 'New' : 'Current'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
    </div>
  );
}

function DocumentPreview({ url, label }: { url: string; label: string }) {
  const isPDF = url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?');
  
  return (
    <div 
      className="document-preview-card"
      onClick={() => window.open(url, '_blank')}
      style={{
        padding: '10px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'background 0.2s'
      }}
    >
      {isPDF ? (
        <div style={{ background: '#ff000015', width: 40, height: 40, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4d' }}>
          <FileText size={20} />
        </div>
      ) : (
        <img src={url} alt={label} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
      )}
      <div className="flex flex-col">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to view full size</span>
      </div>
    </div>
  );
}

function Users({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
