'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { 
  Upload, 
  ArrowLeft, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';

interface ImportRow {
  FirstName: string;
  MiddleName?: string;
  LastName?: string;
  FirstName_NE?: string;
  LastName_NE?: string;
  FatherName?: string;
  GrandfatherName?: string;
  SpouseName?: string;
  Province?: string;
  District?: string;
  Municipality?: string;
  Ward?: string;
  Tole?: string;
  CitizenshipNo?: string;
  CitizenshipDist?: string;
  IssueDate_AD?: string;
  Email?: string;
  Phone?: string;
  PAN?: string;
  NID?: string;
  DMAT?: string;
  BankName?: string;
  BranchName?: string;
  AccountNo?: string;
}

export default function BulkImportPage() {
  const supabase = createClient();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file first');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const totalRows = rows.length;
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // We'll process in batches of 50 to avoid hitting limits or timeouts
        const batchSize = 50;
        for (let i = 0; i < totalRows; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          const payloads = batch.map((row) => ({
            first_name: row.FirstName?.trim() || 'Missing Name',
            middle_name: row.MiddleName?.trim() || null,
            last_name: row.LastName?.trim() || '',
            first_name_ne: row.FirstName_NE?.trim() || null,
            last_name_ne: row.LastName_NE?.trim() || null,
            father_name: row.FatherName?.trim() || null,
            grandfather_name: row.GrandfatherName?.trim() || null,
            spouse_name: row.SpouseName?.trim() || null,
            perm_address: {
              province: row.Province?.trim() || '',
              district: row.District?.trim() || '',
              municipality: row.Municipality?.trim() || '',
              ward: row.Ward?.trim() || '',
              tole: row.Tole?.trim() || '',
            },
            citizenship_no: row.CitizenshipNo?.trim() || '',
            citizenship_district: row.CitizenshipDist?.trim() || '',
            citizenship_issue_date: row.IssueDate_AD?.trim() || null,
            email: row.Email?.trim() || null,
            phone_number: row.Phone?.trim() || null,
            pan_no: row.PAN?.trim() || null,
            nid_no: row.NID?.trim() || null,
            demat_no: row.DMAT?.trim() || null,
            bank_details: [
              {
                bank_name: row.BankName?.trim() || '',
                branch_name: row.BranchName?.trim() || '',
                account_no: row.AccountNo?.trim() || '',
              }
            ],
            member_since: new Date().toISOString().split('T')[0],
            kyc_status: 'pending',
            is_active: true,
            created_by: user?.id,
          }));

          const { error } = await supabase.from('shareholders').insert(payloads);

          if (error) {
            failedCount += batch.length;
            errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
          } else {
            successCount += batch.length;
          }
        }

        setResults({
          success: successCount,
          failed: failedCount,
          errors,
        });
        setLoading(false);
        
        if (failedCount === 0) {
          toast.success(`Successfully imported ${successCount} shareholders!`);
        } else if (successCount > 0) {
          toast.error(`Partially imported. ${successCount} succeeded, ${failedCount} failed.`);
        } else {
          toast.error('Import failed completely. Check the error log.');
        }
      },
      error: (err) => {
        toast.error(`CSV Parsing error: ${err.message}`);
        setLoading(false);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link 
        href="/dashboard/shareholders" 
        className="flex items-center text-muted hover:text-primary transition-colors mb-6 gap-2 no-print"
      >
        <ArrowLeft size={16} /> Back to Shareholders
      </Link>

      <div className="card glass-card">
        <div className="card-header border-b border-white/10 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Upload size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Bulk Shareholder Import</h1>
              <p className="text-muted">Upload your CSV file to import shareholders in bulk</p>
            </div>
          </div>
        </div>

        {!results ? (
          <div className="space-y-8">
            {/* Template Section */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Need a template?</h3>
                  <p className="text-sm text-muted">Use our provided template for accurate column mapping.</p>
                </div>
              </div>
              <a 
                href="/shareholder_import_template.csv" 
                download
                className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 whitespace-nowrap"
              >
                <Download size={16} /> Download Template
              </a>
            </div>

            {/* Upload Area */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium mb-2 block">1. Select CSV File</span>
                <div className={`
                  relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                  ${file ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20'}
                `}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className={`p-4 rounded-full ${file ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}>
                      <Upload size={32} />
                    </div>
                    {file ? (
                      <div>
                        <p className="font-semibold text-primary">{file.name}</p>
                        <p className="text-sm text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold">Click or drag and drop your CSV</p>
                        <p className="text-sm text-muted">Supports .csv files up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </label>

              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="btn btn-primary w-full !py-4 flex items-center justify-center gap-2 text-lg font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Start Bulk Import
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Results Display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">{results.success}</div>
                <div className="text-sm text-muted">Imported Successfully</div>
              </div>
              <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">{results.failed}</div>
                <div className="text-sm text-muted">Failed to Import</div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2 mb-4 text-red-400">
                  <AlertCircle size={18} />
                  <h3 className="font-semibold text-lg">Error Details</h3>
                </div>
                <ul className="space-y-3">
                  {results.errors.map((err, i) => (
                    <li key={i} className="text-sm text-muted border-l-2 border-red-500/30 pl-4 py-1">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => setResults(null)}
                className="btn btn-secondary flex-1"
              >
                Import More Data
              </button>
              <button 
                onClick={() => router.push('/dashboard/shareholders')}
                className="btn btn-primary flex-1"
              >
                View shareholders List
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!results && (
          <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="font-semibold mb-4 text-primary">Instructions & Tips</h3>
            <ul className="space-y-3 text-sm text-muted list-disc pl-5">
              <li><strong>Required Fields:</strong> FirstName, LastName, CitizenshipNo, and CitizenshipDist must not be empty.</li>
              <li><strong>Date Format:</strong> Ensure IssueDate_AD is in YYYY-MM-DD format (Example: 2024-03-25).</li>
              <li><strong>Duplicates:</strong> The system will attempt to skip duplicates naturally if CitizenshipNo matches.</li>
              <li><strong>Character Encoding:</strong> Save your CSV as UTF-8 for proper support of Nepali names.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
