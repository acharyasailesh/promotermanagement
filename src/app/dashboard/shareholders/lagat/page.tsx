'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { adToBs } from '@/lib/utils/nepaliDate';

interface Shareholder {
  id: string;
  member_id: string | number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  first_name_ne: string | null;
  middle_name_ne: string | null;
  last_name_ne: string | null;
  father_name: string | null;
  father_name_ne: string | null;
  grandfather_name: string | null;
  grandfather_name_ne: string | null;
  citizenship_no: string;
  member_since: string;
  nominee_name: string | null;
  nominee_name_ne: string | null;
  share_certificates: any[];
  perm_address: any;
}

interface CompanySetting {
  company_name: string;
  address: string;
  logo_url: string | null;
  stamp_url?: string | null;
}

const toNepaliDigit = (num: number | string | null | undefined) => {
  if (num === null || num === undefined || num === '') return '—';
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).split('').map(char => {
    const index = parseInt(char);
    return isNaN(index) ? char : nepaliDigits[index];
  }).join('');
};

export default function ShareholderLagatPage() {
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [president, setPresident] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: cData } = await supabase
          .from('company_settings')
          .select('company_name, address, logo_url, stamp_url')
          .single();
        if (cData) setCompany(cData);

        const { data: sigData } = await supabase
          .from('signatories')
          .select('name, signature_url, designation')
          .ilike('designation', '%president%')
          .eq('is_active', true)
          .maybeSingle();
        if (sigData) setPresident(sigData);

        const { data: sData, error: sError } = await supabase
          .from('shareholders')
          .select('*')
          .is('deleted_at', null);

        if (sError) throw sError;

        const { data: certData, error: cError } = await supabase
          .from('share_certificates')
          .select('*')
          .is('deleted_at', null);

        if (cError) throw cError;

        const getTranslit = async (text: string) => {
          if (!text) return '';
          try {
            const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=ne-t-i0-und&num=1`);
            const json = await res.json();
            if (json[0] === 'SUCCESS' && json[1] && json[1][0] && json[1][0][1]) {
              return json[1][0][1][0] || text;
            }
          } catch (e) {}
          return text;
        };

        const minDate = Math.min(...(sData || []).map((shAny: any) => shAny.member_since ? new Date(shAny.member_since).getTime() : 9999999999999));

        const mapped = await Promise.all((sData || []).map(async sh => {
          const address = sh.cit_address || sh.perm_address;
          let addressString_ne = '—';
          if (address) {
            const muni = await getTranslit(address.municipality || '');
            const dist = await getTranslit(address.district || '');
            const ward = address.ward ? toNepaliDigit(address.ward) : '';
            addressString_ne = `${muni}-${ward}, ${dist}`;
          }

          const relationMap: any = {
            friend: 'साथी', son: 'छोरा', daughter: 'छोरी', spouse: 'श्रीमान/श्रीमती',
            wife: 'श्रीमती', husband: 'श्रीमान', father: 'बुबा', mother: 'आमा', sibling: 'दिदी-बहिनी/दाजु-भाइ'
          };
          let nomineeString_ne = '—';
          if (sh.nominee_name_ne || (sh as any).nominee_name) {
            const nName = sh.nominee_name_ne || await getTranslit((sh as any).nominee_name || '');
            const rel = ((sh as any).nominee_relation || '').toLowerCase().trim();
            const nRelation = relationMap[rel] || ((sh as any).nominee_relation ? await getTranslit((sh as any).nominee_relation) : '');
            nomineeString_ne = `${nName}${nRelation ? ' (' + nRelation + ')' : ''}`;
          }

          const myCerts = (certData || []).filter((c: any) => c.shareholder_id === sh.id);
          const minK = myCerts.length > 0 ? Math.min(...myCerts.map((c: any) => c.kitta_from || 0)) : 99999999;
          
          return {
            ...sh,
            addressString_ne,
            nomineeString_ne,
            isFounder: sh.member_since && new Date(sh.member_since).getTime() === minDate,
            share_certificates: myCerts,
            minK
          };
        }));

        const sorted = mapped.sort((a, b) => (a.minK || 0) - (b.minK || 0));
        setShareholders(sorted as any);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="lagat-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', background: '#fff', color: '#000' }}>
      <div className="flex justify-between items-center mb-6 no-print">
        <Link href="/dashboard/shareholders" className="btn btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Shareholders
        </Link>
        <button className="btn btn-primary flex items-center gap-2" onClick={handlePrint}>
          <Printer size={16} /> Print Lagat
        </button>
      </div>

      <div className="lagat-header text-center mb-6">
        <p style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>अनुसूची १४</p>
        <p style={{ fontSize: '13px', margin: '4px 0', color: '#333' }}>दफा ४६ को उपदफा (१) सँग सम्बन्धित</p>
        <h1 style={{ fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', margin: '4px 0' }}>
          {(company as any)?.company_name_ne || (company?.company_name && company.company_name.toLowerCase().includes('bihani') ? 'ग्लोबल विहानी इन्भेष्टमेन्ट प्रा. लि.' : company?.company_name) || 'ग्लोबल विहानी इन्भेष्टमेन्ट प्रा. लि.'}
        </h1>
        <p style={{ fontSize: '13px', margin: '4px 0' }}>को</p>
        <div style={{ marginTop: '8px', borderBottom: '2px solid #000', display: 'inline-block', paddingBottom: '4px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>शेयरधनी दर्ता किताब</h2>
        </div>
      </div>

      <div className="lagat-body">
        {loading ? (
          <div className="text-center py-10">Loading Lagat details...</div>
        ) : shareholders.length === 0 ? (
          <div className="text-center py-10">No shareholders found.</div>
        ) : (
          <div className="lagat-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="lagat-table w-full border-collapse" style={{ border: '1px solid #000', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '40px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '85px' }} />
                <col style={{ width: '85px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '50px' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={3}>क्र.सं.</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={3}>शेयर होल्डरको नाम थर तथा ठेगाना</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={3}>बुवाको नाम</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={3}>ना.प्र.नं.</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} colSpan={3}>शेयर/डिबेञ्चरको संख्या</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={2}>भुक्तानी भएको</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={2}>भुक्तानी हुन बाँकी</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }} rowSpan={3}>शेयरवालाको रुपमा नाम दर्ता भएको मिति</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }} rowSpan={3}>शेयरधनीको नाम खारेज भएको मिति</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }} rowSpan={3}>शेयरधनीको शेष पछिको हकदार नियुक्त भए व्यक्तिको नाम र ठेगाना</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }} rowSpan={3}>कैफियत</th>
                </tr>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }} colSpan={2}>कित्ता नं.</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }} rowSpan={2}>जम्मा</th>
                </tr>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>देखि</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>सम्म</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }}>रु.</th>
                  <th className="border border-black p-1 text-center" style={{ fontSize: '12px' }}>रु.</th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((sh, index) => {
                  const certs = sh.share_certificates || [];
                  const totalShares = certs.reduce((sum, c) => sum + (c.num_shares || 0), 0);
                  const totalPaid = certs.reduce((sum, c) => sum + ((c.num_shares || 0) * (c.face_value || 0)), 0);
                  
                  const sortedCerts = [...certs].sort((a, b) => (a.kitta_from || 0) - (b.kitta_from || 0));
                  const minKitta = sortedCerts.length > 0 ? sortedCerts[0].kitta_from : '';
                  const maxKitta = sortedCerts.length > 0 ? sortedCerts[sortedCerts.length - 1].kitta_to : '';

                  const fullNameNP = `${sh.first_name_ne || sh.first_name} ${sh.middle_name_ne ? sh.middle_name_ne + ' ' : ''}${sh.last_name_ne || sh.last_name}`;
                  const addressString = (sh as any).addressString_ne || '—';

                  return (
                    <tr key={sh.id}>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>{toNepaliDigit(index + 1)}</td>
                      <td className="border border-black p-1" style={{ fontSize: '11px' }}>
                        <div><strong>{fullNameNP}</strong></div>
                        <div style={{ fontSize: '10px', color: '#555' }}>ठेगाना: {addressString}</div>
                      </td>
                      <td className="border border-black p-1" style={{ fontSize: '11px' }}>{sh.father_name_ne || sh.father_name || '—'}</td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>{toNepaliDigit(sh.citizenship_no)}</td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>
                        {sortedCerts.map((c, i) => <div key={i}>{toNepaliDigit(c.kitta_from)}</div>)}
                        {sortedCerts.length === 0 && '—'}
                      </td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>
                        {sortedCerts.map((c, i) => <div key={i}>{toNepaliDigit(c.kitta_to)}</div>)}
                        {sortedCerts.length === 0 && '—'}
                      </td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px', fontWeight: 600 }}>
                        {sortedCerts.map((c, i) => <div key={i}>{toNepaliDigit(c.num_shares)}</div>)}
                        {sortedCerts.length === 0 && '—'}
                      </td>
                      <td className="border border-black p-1 text-right" style={{ fontSize: '11px' }}>
                        {sortedCerts.map((c, i) => {
                          const paid = (c.num_shares || 0) * (c.face_value || 100);
                          return <div key={i}>{toNepaliDigit(paid.toLocaleString())}</div>;
                        })}
                        {sortedCerts.length === 0 && '—'}
                      </td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>छैन ।</td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '10px' }}>{(sh as any).isFounder ? 'संस्थापक' : sh.member_since ? toNepaliDigit(adToBs(sh.member_since)) : '—'}</td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>छैन ।</td>
                      <td className="border border-black p-1" style={{ fontSize: '11px' }}>{(sh as any).nomineeString_ne}</td>
                      <td className="border border-black p-1 text-center" style={{ fontSize: '11px' }}>छैन ।</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && shareholders.length > 0 && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', padding: '0 24px', position: 'relative' }}>
          <div style={{ textAlign: 'center', width: '220px', position: 'relative' }}>
            {company?.stamp_url && (
              <img 
                src={company.stamp_url} 
                alt="Stamp" 
                style={{ 
                  position: 'absolute', 
                  right: '-45px', 
                  bottom: '35px', 
                  opacity: 0.85, 
                  maxHeight: '80px', 
                  maxWidth: '80px', 
                  pointerEvents: 'none',
                  zIndex: 0
                }} 
              />
            )}
            {president?.signature_url && (
              <div style={{ height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
                <img src={president.signature_url} alt="Signature" style={{ maxHeight: '50px', maxWidth: '160px', objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ borderBottom: '1px solid #000', marginTop: (president?.signature_url ? '4px' : '50px') }}></div>
            <p style={{ fontSize: '14px', marginTop: '6px', fontWeight: 700 }}>{president?.name || '—'}</p>
            <p style={{ fontSize: '13px', marginTop: '2px', fontWeight: 600 }}>सञ्चालक (Director/President)</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .lagat-container, .lagat-container * {
            visibility: visible;
          }
          .lagat-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            padding: 10mm !important;
          }
          .no-print {
            display: none !important;
          }
          .lagat-table-wrapper {
            overflow: visible !important;
          }
          table {
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
