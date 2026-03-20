'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Award, Printer, ArrowLeft } from 'lucide-react';
import { adToBs } from '@/lib/utils/nepaliDate';

interface CertificateData {
  id: string;
  certificate_no: string;
  issue_date: string;
  kitta_from: number;
  kitta_to: number;
  num_shares: number;
  shareholders: {
    id: string;
    member_id: number;
    first_name: string;
    last_name: string;
    first_name_ne?: string;
    last_name_ne?: string;
    middle_name_ne?: string;
    father_name_ne?: string;
    citizenship_no?: string;
    district_ne?: string;
    vdc_mun_ne?: string;
    ward_no_ne?: string;
    district?: string;
    vdc_mun?: string;
    ward_no?: string;
    perm_address?: any;
    cit_address?: any;
    citizenship_district?: string;
  };
  investments?: {
    amount: number;
  };
}

interface Signatory {
  name: string;
  designation: string;
  signature_url: string | null;
}

interface CompanySettings {
  company_name_ne: string;
  company_name_en: string;
  logo_url: string | null;
  stamp_url: string | null;
  regd_no?: string;
  pan_no?: string;
  certificate_bg_url?: string | null;
  vat_no?: string | null;
  certificate_coords?: Record<string, { top: number; left: number }>;
}

export default function PrintCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const certId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // 1. Fetch Certificate
    const { data: certData, error } = await supabase
      .from('share_certificates')
      .select('*, shareholders!share_certificates_shareholder_id_fkey(*), investments(amount)')
      .eq('id', certId)
      .single();

    if (error) {
      console.error("Cert Fetch Error:", error);
      setErrorMsg(error.message);
    }

    if (certData) setCert(certData as CertificateData);

    // 2. Fetch Signatories
    const { data: sigData } = await supabase
      .from('signatories')
      .select('name, designation, signature_url')
      .eq('is_active', true);
    setSignatories(sigData || []);

    // 3. Fetch Company Settings
    const { data: compData } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    setCompany(compData as CompanySettings);

    setLoading(false);
  }, [supabase, certId]);

  useEffect(() => {
    if (certId) fetchDetails();
  }, [certId, fetchDetails]);

  const toNepaliDigit = (num: any) => {
    if (num === null || num === undefined) return '';
    const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return num.toString().split('').map((d: string) => nepaliDigits[parseInt(d)] !== undefined ? nepaliDigits[parseInt(d)] : d).join('');
  };

  const numberToNepaliWords = (num: number) => {
    if (num === 0) return 'शुन्य';

    const numbers: { [key: number]: string } = {
      0: '', 1: 'एक', 2: 'दुई', 3: 'तीन', 4: 'चार', 5: 'पाँच', 6: 'छ', 7: 'सात', 8: 'आठ', 9: 'नौ',
      10: 'दश', 11: 'एघार', 12: 'बाह्र', 13: 'तेह्र', 14: 'चौध', 15: 'पन्ध्र', 16: 'सोह्र', 17: 'सत्र', 18: 'अठार', 19: 'उन्नाइस',
      20: 'बीस', 21: 'एक्काइस', 22: 'बाइस', 23: 'तेईस', 24: 'चौबिस', 25: 'पच्चिस', 26: 'छब्बिस', 27: 'सत्ताइस', 28: 'अठ्ठाइस', 29: 'उन्तीस',
      30: 'तीस', 31: 'एकतीस', 32: 'बत्तीस', 33: 'तेत्तीस', 34: 'चौंतीस', 35: 'पैंतीस', 36: 'छत्तीस', 37: 'सैंतीस', 38: 'अठतीस', 39: 'उनन्चालीस',
      40: 'चालीस', 41: 'एकचालीस', 42: 'बयालीस', 43: 'त्रिचालीस', 44: 'चौबालीस', 45: 'पैंतालीस', 46: 'छ्यालीस', 47: 'सतचालीस', 48: 'अठचालीस', 49: 'उनन्चास',
      50: 'पचास', 51: 'एकाउन्न', 52: 'बाउन्न', 53: 'त्रिपन्न', 54: 'चौपन्न', 55: 'पचपन्न', 56: 'छपन्न', 57: 'सताउन्न', 58: 'अठाउन्न', 59: 'उनन्साठ्ठी',
      60: 'साठ्ठी', 61: 'एकसठ्ठी', 62: 'बाइसठ्ठी', 63: 'त्रिसठ्ठी', 64: 'चौंसठ्ठी', 65: 'पैंसठ्ठी', 66: 'छयसठ्ठी', 67: 'सतसठ्ठी', 68: 'अठसठ्ठी', 69: 'उनन्सत्तर',
      70: 'सत्तर', 71: 'एकहत्तर', 72: 'बहत्तर', 73: 'त्रिहत्तर', 74: 'चौहत्तर', 75: 'पचहत्तर', 76: 'छहत्तर', 77: 'सतहत्तर', 78: 'अठहत्तर', 79: 'उनन्असी',
      80: 'असी', 81: 'एकासी', 82: 'बयासी', 83: 'त्रियासी', 84: 'चौरासी', 85: 'पचासी', 86: 'छयासी', 87: 'सतासी', 88: 'अठासी', 89: 'उनन्नब्बे',
      90: 'नब्बे', 91: 'एकानब्बे', 92: 'बयानब्बे', 93: 'त्रियानब्बे', 94: 'चौरानब्बे', 95: 'पञ्चानब्बे', 96: 'छ्यानब्बे', 97: 'सतानब्बे', 98: 'अठानब्बे', 99: 'उनन्सौ'
    };

    let words = '';
    let rem = num;

    if (rem >= 10000000) {
      const crore = Math.floor(rem / 10000000);
      words += crore < 100 ? numbers[crore] + ' करोड ' : crore + ' करोड ';
      rem %= 10000000;
    }
    if (rem >= 100000) {
      const lakh = Math.floor(rem / 100000);
      words += numbers[lakh] + ' लाख ';
      rem %= 100000;
    }
    if (rem >= 1000) {
      const thousand = Math.floor(rem / 1000);
      words += numbers[thousand] + ' हजार ';
      rem %= 1000;
    }
    if (rem >= 100) {
      const hundred = Math.floor(rem / 100);
      words += numbers[hundred] + ' सय ';
      rem %= 100;
    }
    if (rem > 0) {
      if (numbers[rem]) words += numbers[rem];
    }
    return (words.trim() + ' रुपैयाँ मात्र');
  };

  const handlePrint = () => { window.print(); };

  const accountant = signatories.find(s => s.designation.toLowerCase().includes('लेखापाल') || s.designation.includes('Accountant'));
  const director = signatories.find(s => s.designation.includes('संचालक') || s.designation.includes('Director') || s.designation.includes('Officer'));
  const president = signatories.find(s => s.designation.includes('अध्यक्ष') || s.designation.includes('President') || s.designation.includes('Chairman'));

  const getStyle = (key: string, defTop: string, defLeft: string) => {
    const item = company?.certificate_coords?.[key];
    if (!item) return { position: 'absolute' as 'absolute', top: defTop, left: defLeft };
    // Use direct pixel values — the certificate container is rendered at 1000x707px (same as canvas builder)
    return {
      position: 'absolute' as 'absolute',
      top: `${item.top}px`,
      left: `${item.left}px`
    };
  };

  if (loading) return <div className="p-8 text-center">Loading certificate layout...</div>;
  if (!cert) return <div className="p-8 text-center text-red-500">Certificate not found. {errorMsg && <div style={{ fontSize: '11px', color: '#666' }}>Error Details: {errorMsg}</div>}</div>;

  const sh = cert.shareholders;
  const fullNameNP = `${sh.first_name_ne || sh.first_name} ${sh.middle_name_ne ? sh.middle_name_ne + ' ' : ''}${sh.last_name_ne || sh.last_name}`;

  // Fetch address inside saved JSON (Prioritising Citizenship Address)
  const distRaw = sh?.cit_address?.district || sh?.citizenship_district || sh?.perm_address?.district || '';
  const munRaw = sh?.cit_address?.municipality || sh?.cit_address?.vdc_mun || sh?.perm_address?.municipality || '';
  const ward = sh?.cit_address?.ward || sh?.cit_address?.ward_no || sh?.perm_address?.ward || '';

  // Simple Translation Map offset framing sequential Node securely 
  const addressTranslate: Record<string, string> = {
    'Parwat': 'पर्वत',
    'Phalewas': 'फलेवास',
    'Phalewas Municipality': 'फलेवास नगरपालिका',
    'Gandaki': 'गण्डकी',
    'Chabise': 'चाबिसे',
    'Bachchha': 'बच्छा',
    'Kushma': 'कुश्मा',
    'Kushma Municipality': 'कुश्मा नगरपालिका'
  };

  const dist = addressTranslate[distRaw] || distRaw;
  const mun = addressTranslate[munRaw] || munRaw;

  return (
    <div className="min-h-screen bg-gray-50 p-4 certificate-outer-wrapper">
      <style>{`
        @page { 
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          html, body { 
            margin: 0 !important; 
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .certificate-outer-wrapper { 
            padding: 0 !important; 
            margin: 0 !important;
            background: transparent !important; 
            min-height: 0 !important;
          }
          /* Keep wrapper and outer at FIXED 1000x707 so coordinate system matches exactly */
          .certificate-scale-wrapper {
            width: 1000px !important;
            margin: 0 !important;
          }
          .certificate-outer { 
            box-shadow: none !important; 
            border: none !important; 
            width: 1000px !important;
            height: 707px !important;
            page-break-inside: avoid !important;
            overflow: visible !important;
            margin: 0 !important; 
          }
        }
      `}</style>
      {/* TOOLBAR */}
      <div className="print:hidden max-w-5xl mx-auto mb-4 flex items-center justify-between no-print">
        <button className="btn btn-ghost flex items-center gap-2" onClick={() => router.back()}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className="btn btn-primary flex items-center gap-2" onClick={handlePrint}>
          <Printer size={16} /> Print Certificate
        </button>
      </div>

      {/* CERTIFICATE — fixed at 1000x707 on screen, scales to page on print */}
      <div className="certificate-scale-wrapper" style={{ width: '1000px', margin: '0 auto' }}>
        <div
          className="certificate-outer"
          style={{
            width: '1000px',
            height: '707px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}
        >
          {/* BACKGROUND IMAGE — fills exactly 1000x707, same as canvas builder */}
          {company?.certificate_bg_url && (
            <img
              src={company.certificate_bg_url}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1, pointerEvents: 'none' }}
              alt=""
            />
          )}

          {/* DYNAMIC TEXT OVERLAY — coordinates from canvas builder map 1:1 */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '1000px', height: '707px', zIndex: 10 }}>

            {/* certificate_no */}
            <div className="cert-overlay-item" style={{ ...getStyle('certNo', '220px', '135px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {toNepaliDigit(cert?.certificate_no || '१')}
            </div>

            {/* District */}
            <div className="cert-overlay-item" style={{ ...getStyle('district', '272px', '20px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {dist}
            </div>

            {/* Municipality */}
            <div className="cert-overlay-item" style={{ ...getStyle('municipality', '272px', '240px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {mun}
            </div>

            {/* Ward No */}
            <div className="cert-overlay-item" style={{ ...getStyle('ward', '272px', '615px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {toNepaliDigit(ward)}
            </div>

            {/* Shareholder Full Name */}
            <div className="cert-overlay-item" style={{ ...getStyle('fullName', '305px', '75px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {fullNameNP}
            </div>

            {/* Amount in digits (inline with रु.) */}
            <div className="cert-overlay-item" style={{ ...getStyle('amountKitta', '305px', '340px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {toNepaliDigit(Array.isArray(cert?.investments) ? cert.investments[0]?.amount : cert?.investments?.amount || '')}/-
            </div>

            {/* रु. digits */}
            <div className="cert-overlay-item" style={{ ...getStyle('amountDigits', '345px', '45px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {toNepaliDigit(Array.isArray(cert?.investments) ? cert.investments[0]?.amount : cert?.investments?.amount || '')}/-
            </div>

            {/* Amount in words */}
            <div className="cert-overlay-item" style={{ ...getStyle('amountWords', '345px', '190px'), position: 'absolute', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>
              {numberToNepaliWords(Array.isArray(cert?.investments) ? cert.investments[0]?.amount : cert?.investments?.amount || 0)}
            </div>

            {/* Signatures */}
            {accountant?.signature_url && (
              <div style={{ ...getStyle('accountantSig', '415px', '500px'), position: 'absolute', zIndex: 20, mixBlendMode: 'multiply' }}>
                <img src={accountant.signature_url} style={{ height: '35px', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply', filter: 'contrast(1.8) brightness(1.4) grayscale(1)' }} alt="Accountant" />
              </div>
            )}
            {director?.signature_url && (
              <div style={{ ...getStyle('directorSig', '415px', '40px'), position: 'absolute', zIndex: 20, mixBlendMode: 'multiply' }}>
                <img src={director.signature_url} style={{ height: '35px', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply', filter: 'contrast(1.8) brightness(1.4) grayscale(1)' }} alt="Director" />
              </div>
            )}
            {president?.signature_url && (
              <div style={{ ...getStyle('presidentSig', '415px', '740px'), position: 'absolute', zIndex: 20, mixBlendMode: 'multiply' }}>
                <img src={president.signature_url} style={{ height: '35px', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply', filter: 'contrast(1.8) brightness(1.4) grayscale(1)' }} alt="President" />
              </div>
            )}
            {company?.stamp_url && (
              <div style={{ ...getStyle('stamp', '400px', '290px'), position: 'absolute', zIndex: 20, mixBlendMode: 'multiply' }}>
                <img src={company.stamp_url} style={{ height: '60px', width: '60px', objectFit: 'contain', opacity: 0.75, mixBlendMode: 'multiply', filter: 'contrast(1.5) brightness(1.2)' }} alt="Stamp" />
              </div>
            )}

            {/* Date */}
            <div className="cert-overlay-item" style={{ ...getStyle('dateStamp', '448px', '310px'), position: 'absolute', fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
              {toNepaliDigit(cert?.issue_date ? adToBs(cert.issue_date) : '')}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
