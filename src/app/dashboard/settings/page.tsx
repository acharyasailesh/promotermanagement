"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  Save,
  Building2,
  Plus,
  X,
  Calendar,
  History,
  Search,
  Eye,
  Filter,
  Trash2,
  RotateCcw,
  Landmark,
  Edit2,
  Upload,
  User,
} from "lucide-react";
import { processImage } from "@/lib/utils/imageProcess";

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  registration_no: string | null;
  pan_no: string | null;
  share_face_value: number;
  loan_max_percentage: number;
  default_interest_rate?: number;
  service_charge?: number;
  grace_period?: number;
  penalty_percent?: number;
  default_letter_pad_url: string | null;
  stamp_url: string | null;
  certificate_bg_url: string | null;
  vat_no: string | null;
  certificate_coords?: Record<
    string,
    { top: number; left: number; width?: string; height?: string }
  >;
}

interface FiscalYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  initial_balance: number;
  is_active: boolean;
  cheque_books?: ChequeBook[];
}

interface ChequeBook {
  id: string;
  company_bank_id: string;
  start_no: number;
  end_no: number;
  is_active: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  phone_number: string | null;
  signature_url: string | null;
  designation: string | null;
}

interface Signatory {
  id: string;
  profile_id?: string | null;
  name: string;
  designation: string;
  signature_url: string | null;
  is_active: boolean;
}

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  performed_by: string;
  created_at: string;
  profiles?: { full_name: string };
}

interface DeletedRecord {
  id: string;
  type: string;
  name: string;
  deleted_at: string;
  table: string;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [recycleSearch, setRecycleSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] =
    useState(false);
  const [recordToDeleteForever, setRecordToDeleteForever] =
    useState<DeletedRecord | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    loading: boolean;
  }>({
    title: "",
    message: "",
    onConfirm: () => {},
    loading: false,
  });

  // Modals
  const [showFyModal, setShowFyModal] = useState(false);
  const [fyForm, setFyForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });

  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<CompanyBank | null>(null);
  const [bankForm, setBankForm] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    branch: "",
    initial_balance: "0",
  });

  const [showChequeModal, setShowChequeModal] = useState(false);
  const [chequeForm, setChequeForm] = useState({
    company_bank_id: "",
    start_no: "",
    end_no: "",
  });
  const [savingCheque, setSavingCheque] = useState(false);

  const [showSignatoryModal, setShowSignatoryModal] = useState(false);
  const [editingSignatory, setEditingSignatory] = useState<Signatory | null>(
    null,
  );
  const [signatoryForm, setSignatoryForm] = useState({
    name: "",
    designation: "",
    signature_url: null as string | null,
  });

  // Certificate Layout Builder
  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [coords, setCoords] = useState<
    Record<
      string,
      { top: number; left: number; width?: string; height?: string }
    >
  >({});
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleDragStart = (id: string, e: React.MouseEvent) => {
    setDraggingItem(id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!draggingItem) return;
    const canvas = document.getElementById("layout-canvas");
    if (!canvas) return;
    // Use the inner content div (no border) for accurate coords
    const canvasRect = canvas.getBoundingClientRect();

    let left = e.clientX - canvasRect.left - dragOffset.x;
    let top = e.clientY - canvasRect.top - dragOffset.y;

    // Clamp within canvas bounds
    left = Math.max(0, Math.min(left, 1000 - 2));
    top = Math.max(0, Math.min(top, 707 - 2));

    setCoords((prev) => ({
      ...prev,
      [draggingItem]: {
        ...prev[draggingItem],
        top: Math.round(top),
        left: Math.round(left),
      },
    }));
  };

  const handleDragEnd = () => setDraggingItem(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    const [settRes, fyRes, profRes, bankRes, chqRes, sigRes] =
      await Promise.all([
        supabase.from("company_settings").select("*").order("updated_at", { ascending: false }).limit(1).single(),
        supabase
          .from("fiscal_years")
          .select("*")
          .order("start_date", { ascending: false }),
        user
          ? supabase.from("profiles").select("*").eq("id", user.id).single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("company_banks")
          .select("*")
          .order("bank_name", { ascending: true }),
        supabase.from("cheque_books").select("*"),
        supabase
          .from("signatories")
          .select("*")
          .order("name", { ascending: true }),
      ]);

    if (settRes.data) setSettings(settRes.data as CompanySettings);
    setFiscalYears((fyRes.data || []) as FiscalYear[]);

    const banksWithBooks = (bankRes.data || []).map((b) => ({
      ...b,
      cheque_books: (chqRes.data || []).filter(
        (c) => c.company_bank_id === b.id,
      ),
    }));
    setBanks(banksWithBooks as CompanyBank[]);
    if (profRes.data) setProfile(profRes.data as Profile);
    setSignatories((sigRes.data || []) as Signatory[]);

    // Super Admin extra data
    if (profRes.data?.role === "super_admin") {
      const auditRes = await supabase
        .from("audit_logs")
        .select("*, profiles:performed_by(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      setAuditLogs((auditRes.data || []) as AuditLog[]);

      const [
        shRes,
        exRes,
        invRes,
        lnRes,
        mtRes,
        chalRes,
        docRes,
        certRes,
        compRes,
      ] = await Promise.all([
        supabase
          .from("shareholders")
          .select("id, first_name, last_name, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("expenses")
          .select("id, description, amount, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("investments")
          .select("id, amount, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("loans")
          .select("id, principal, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("board_meetings")
          .select("id, title, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("chalanis")
          .select("id, subject, reference_no, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("documents")
          .select("id, title, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("share_certificates")
          .select("id, certificate_no, num_shares, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("complaints")
          .select("id, complaint_no, subject, deleted_at")
          .not("deleted_at", "is", null),
      ]);

      const combined: DeletedRecord[] = [
        ...(shRes.data || []).map((r) => ({
          id: r.id,
          type: "Shareholder",
          name: `${r.first_name} ${r.last_name}`,
          deleted_at: r.deleted_at,
          table: "shareholders",
        })),
        ...(exRes.data || []).map((r) => ({
          id: r.id,
          type: "Expense",
          name: r.description || `Amount: Rs. ${r.amount}`,
          deleted_at: r.deleted_at,
          table: "expenses",
        })),
        ...(invRes.data || []).map((r) => ({
          id: r.id,
          type: "Investment",
          name: `Investment: Rs. ${r.amount}`,
          deleted_at: r.deleted_at,
          table: "investments",
        })),
        ...(lnRes.data || []).map((r) => ({
          id: r.id,
          type: "Loan",
          name: `Loan Principal: Rs. ${r.principal}`,
          deleted_at: r.deleted_at,
          table: "loans",
        })),
        ...(mtRes.data || []).map((r) => ({
          id: r.id,
          type: "Meeting",
          name: r.title,
          deleted_at: r.deleted_at,
          table: "board_meetings",
        })),
        ...(chalRes.data || []).map((r) => ({
          id: r.id,
          type: "Chalani",
          name: `${r.reference_no}: ${r.subject}`,
          deleted_at: r.deleted_at,
          table: "chalanis",
        })),
        ...(docRes.data || []).map((r) => ({
          id: r.id,
          type: "Document",
          name: r.title,
          deleted_at: r.deleted_at,
          table: "documents",
        })),
        ...(certRes.data || []).map((r) => ({
          id: r.id,
          type: "Share Certificate",
          name: `Cert #${r.certificate_no} (${r.num_shares} Kitta)`,
          deleted_at: r.deleted_at,
          table: "share_certificates",
        })),
        ...(compRes.data || []).map((r) => ({
          id: r.id,
          type: "Complaint",
          name: `${r.complaint_no}: ${r.subject}`,
          deleted_at: r.deleted_at,
          table: "complaints",
        })),
      ];
      setDeletedRecords(
        combined.sort(
          (a, b) =>
            new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime(),
        ),
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveCompany = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_settings")
      .update({
        company_name: settings.company_name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        registration_no: settings.registration_no,
        pan_no: settings.pan_no,
        share_face_value: settings.share_face_value,
        loan_max_percentage: settings.loan_max_percentage,
        default_interest_rate: settings.default_interest_rate,
        service_charge: settings.service_charge,
        grace_period: settings.grace_period,
        penalty_percent: settings.penalty_percent,
        default_letter_pad_url: settings.default_letter_pad_url,
        logo_url: settings.logo_url,
        stamp_url: settings.stamp_url,
        certificate_bg_url: settings.certificate_bg_url,
        vat_no: settings.vat_no,
      })
      .eq("id", settings.id);
    if (error) toast.error(error.message);
    else toast.success("Saved");
    setSaving(false);
  };

  const handleSaveCoords = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_settings")
      .update({ certificate_coords: coords })
      .eq("id", settings.id);

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Coordinates saved successfully!");
      setSettings({ ...settings, certificate_coords: coords });
      setShowLayoutBuilder(false);
    }
    setSaving(false);
  };

  const handleLetterPadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `settings/letter-pad-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      await supabase
        .from("company_settings")
        .update({ default_letter_pad_url: publicUrl })
        .eq("id", settings.id);
      setSettings({ ...settings, default_letter_pad_url: publicUrl });
      toast.success("Uploaded");
    } catch (err: any) {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `settings/logo-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      await supabase
        .from("company_settings")
        .update({ logo_url: publicUrl })
        .eq("id", settings.id);
      setSettings({ ...settings, logo_url: publicUrl });
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `settings/stamp-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      await supabase
        .from("company_settings")
        .update({ stamp_url: publicUrl })
        .eq("id", settings.id);
      setSettings({ ...settings, stamp_url: publicUrl });
      toast.success("Stamp uploaded");
    } catch (err: any) {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateBgUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `settings/certificate-bg-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      await supabase
        .from("company_settings")
        .update({ certificate_bg_url: publicUrl })
        .eq("id", settings.id);
      setSettings({ ...settings, certificate_bg_url: publicUrl });
      toast.success("Certificate layout uploaded");
    } catch (err: any) {
      toast.error("Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone_number: profile.phone_number,
        signature_url: profile.signature_url,
        designation: profile.designation,
      })
      .eq("id", profile.id);
    if (error) toast.error("Failed");
    else toast.success("Updated");
    setSaving(false);
  };

  const handleSignatureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `signatures/sig-${profile.id}-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      setProfile({ ...profile, signature_url: publicUrl });
      toast.success("Signature uploaded");
    } catch (err: any) {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignatory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...signatoryForm };
    let error;
    if (editingSignatory) {
      const { error: err } = await supabase
        .from("signatories")
        .update(payload)
        .eq("id", editingSignatory.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("signatories").insert(payload);
      error = err;
    }
    if (error) toast.error("Failed");
    else {
      toast.success("Success");
      setShowSignatoryModal(false);
      fetchAll();
    }
    setSaving(false);
  };

  const handleDeleteSignatory = (id: string) => {
    setConfirmConfig({
      title: "Delete Signatory",
      message: "Are you sure you want to remove this external signatory?",
      loading: false,
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, loading: true }));
        const { error } = await supabase
          .from("signatories")
          .delete()
          .eq("id", id);
        if (error) toast.error("Failed");
        else {
          toast.success("Deleted");
          fetchAll();
        }
        setShowConfirmModal(false);
      },
    });
    setShowConfirmModal(true);
  };

  const handleSignatorySignatureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const processedFile = await processImage(file);
      const filePath = `signatures/sig-ext-${Date.now()}.webp`;
      await supabase.storage.from("documents").upload(filePath, processedFile);
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);
      setSignatoryForm({ ...signatoryForm, signature_url: publicUrl });
      toast.success("Uploaded");
    } catch (err: any) {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (record: DeletedRecord) => {
    setRestoring(record.id);
    const { error } = await supabase
      .from(record.table)
      .update({ deleted_at: null })
      .eq("id", record.id);
    if (error) toast.error("Failed to restore");
    else {
      toast.success("Restored");
      fetchAll();
    }
    setRestoring(null);
  };

  const handlePermanentDelete = (record: DeletedRecord) => {
    setRecordToDeleteForever(record);
    setShowPermanentDeleteModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!recordToDeleteForever) return;

    setSaving(true);
    const { error } = await supabase
      .from(recordToDeleteForever.table)
      .delete()
      .eq("id", recordToDeleteForever.id);

    if (error) {
      toast.error("Permanent delete failed");
    } else {
      toast.success("Record permanently deleted");
      fetchAll();
      setShowPermanentDeleteModal(false);
    }
    setSaving(false);
  };

  const handleAddFy = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("fiscal_years").insert(fyForm);
    if (error) toast.error(error.message);
    else {
      toast.success("Added");
      setShowFyModal(false);
      fetchAll();
    }
  };

  const setCurrentFy = async (id: string) => {
    await Promise.all([
      supabase.from("fiscal_years").update({ is_current: false }).neq("id", id),
      supabase.from("fiscal_years").update({ is_current: true }).eq("id", id),
    ]);
    toast.success("Updated");
    fetchAll();
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...bankForm,
      initial_balance: parseFloat(bankForm.initial_balance),
    };
    let error;
    if (editingBank) {
      const { error: err } = await supabase
        .from("company_banks")
        .update(payload)
        .eq("id", editingBank.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("company_banks")
        .insert(payload);
      error = err;
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      setShowBankModal(false);
      fetchAll();
    }
    setSaving(false);
  };

  const handleAddChequeBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCheque(true);
    const { error } = await supabase.from("cheque_books").insert({
      ...chequeForm,
      start_no: parseInt(chequeForm.start_no),
      end_no: parseInt(chequeForm.end_no),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Added");
      setShowChequeModal(false);
      fetchAll();
    }
    setSavingCheque(false);
  };

  const tabs = ["Company", "Banks", "Profile", "Signatories", "Fiscal Years"];
  if (profile?.role === "super_admin") {
    tabs.push("Activity Log");
    tabs.push("Recycle Bin");
  }
  tabs.push("Loans");

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.table_name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.profiles?.full_name.toLowerCase().includes(auditSearch.toLowerCase()),
  );

  const filteredRecycle = deletedRecords.filter(
    (r) =>
      r.name.toLowerCase().includes(recycleSearch.toLowerCase()) ||
      r.type.toLowerCase().includes(recycleSearch.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="page-body">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your system</p>
        </div>
      </div>
      <div className="page-body">
        <div className="tabs mb-6">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              className={`tab ${activeTab === i ? "active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && settings && (
          <div className="card">
            <div className="card-header">
              <div className="card-title flex items-center gap-2">
                <Building2 size={18} /> Company Details
              </div>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label>Company Name</label>
                <input
                  className="input"
                  value={settings.company_name}
                  onChange={(e) =>
                    setSettings({ ...settings, company_name: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Address</label>
                <input
                  className="input"
                  value={settings.address}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Email</label>
                <input
                  className="input"
                  value={settings.email || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, email: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={settings.phone || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Regd No.</label>
                <input
                  className="input"
                  value={settings.registration_no || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      registration_no: e.target.value,
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>PAN No.</label>
                <input
                  className="input"
                  value={settings.pan_no || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, pan_no: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>VAT No.</label>
                <input
                  className="input"
                  value={settings.vat_no || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, vat_no: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
              <div className="p-4 border rounded-xl bg-secondary/20">
                <label className="font-bold mb-2 block">Company Logo</label>
                <div className="flex flex-col gap-4 items-center">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      className="h-24 w-24 object-contain bg-white border rounded-full p-2"
                      alt="Logo"
                    />
                  ) : (
                    <div className="h-24 w-24 border-2 border-dashed rounded-full flex items-center justify-center text-muted">
                      No Logo
                    </div>
                  )}
                  <label className="btn btn-secondary btn-sm cursor-pointer w-full justify-center">
                    <Upload size={14} /> Upload Logo
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-secondary/20">
                <label className="font-bold mb-2 block">Company Stamp</label>
                <div className="flex flex-col gap-4 items-center">
                  {settings.stamp_url ? (
                    <img
                      src={settings.stamp_url}
                      className="h-24 w-24 object-contain bg-white border rounded p-2"
                      alt="Stamp"
                    />
                  ) : (
                    <div className="h-24 w-24 border-2 border-dashed rounded flex items-center justify-center text-muted">
                      No Stamp
                    </div>
                  )}
                  <label className="btn btn-secondary btn-sm cursor-pointer w-full justify-center">
                    <Upload size={14} /> Upload Stamp
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleStampUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-secondary/20">
                <label className="font-bold mb-2 block">
                  Company Letter Pad
                </label>
                <div className="flex flex-col gap-4 items-center">
                  {settings.default_letter_pad_url ? (
                    <img
                      src={settings.default_letter_pad_url}
                      className="h-24 w-20 object-contain bg-white border rounded"
                      alt="Pad"
                    />
                  ) : (
                    <div className="h-24 w-20 border-2 border-dashed rounded flex items-center justify-center text-muted">
                      No Image
                    </div>
                  )}
                  <label className="btn btn-secondary btn-sm cursor-pointer w-full justify-center">
                    <Upload size={14} /> Upload Letter Pad
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLetterPadUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-secondary/20">
                <label className="font-bold mb-2 block">
                  Certificate Background
                </label>
                <div className="flex flex-col gap-4 items-center">
                  {settings.certificate_bg_url ? (
                    <img
                      src={settings.certificate_bg_url}
                      className="h-24 w-full object-contain bg-white border rounded p-1"
                      alt="Bg"
                    />
                  ) : (
                    <div className="h-24 w-full border-2 border-dashed rounded flex items-center justify-center text-muted">
                      No Layout
                    </div>
                  )}
                  <label className="btn btn-secondary btn-sm cursor-pointer w-full justify-center">
                    <Upload size={14} /> Upload Layout Background
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleCertificateBgUpload}
                    />
                  </label>
                  {settings.certificate_bg_url && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm w-full mt-2 justify-center"
                      onClick={() => {
                        setCoords(settings.certificate_coords || {});
                        setShowLayoutBuilder(true);
                      }}
                    >
                      Adjust Coordinates
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button
                className="btn btn-primary"
                onClick={handleSaveCompany}
                disabled={saving}
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title flex items-center gap-2">
                <Landmark size={18} /> Bank Accounts
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingBank(null);
                  setBankForm({
                    bank_name: "",
                    account_name: "",
                    account_number: "",
                    branch: "",
                    initial_balance: "0",
                  });
                  setShowBankModal(true);
                }}
              >
                <Plus size={14} /> Add Bank
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="p-4 border rounded-xl bg-secondary/10"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg">{bank.bank_name}</div>
                      <div className="text-sm text-muted">
                        {bank.account_name} | {bank.account_number}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => {
                          setEditingBank(bank);
                          setBankForm({
                            bank_name: bank.bank_name,
                            account_name: bank.account_name,
                            account_number: bank.account_number,
                            branch: bank.branch || "",
                            initial_balance: bank.initial_balance.toString(),
                          });
                          setShowBankModal(true);
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => {
                          setChequeForm({
                            company_bank_id: bank.id,
                            start_no: "",
                            end_no: "",
                          });
                          setShowChequeModal(true);
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {bank.cheque_books?.map((cb) => (
                      <div
                        key={cb.id}
                        className="badge badge-neutral flex gap-2"
                      >
                        {cb.start_no} - {cb.end_no}
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              title: "Delete Cheque Range",
                              message: `Delete range ${cb.start_no} - ${cb.end_no}?`,
                              loading: false,
                              onConfirm: async () => {
                                setConfirmConfig((p) => ({
                                  ...p,
                                  loading: true,
                                }));
                                await supabase
                                  .from("cheque_books")
                                  .delete()
                                  .eq("id", cb.id);
                                fetchAll();
                                setShowConfirmModal(false);
                              },
                            });
                            setShowConfirmModal(true);
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 2 && profile && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">My Profile</div>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label>Full Name</label>
                <input
                  className="input"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Designation</label>
                <input
                  className="input"
                  value={profile.designation || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, designation: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={profile.phone_number || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone_number: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label>Role</label>
                <input
                  className="input disabled"
                  value={profile.role}
                  disabled
                />
              </div>
            </div>
            <div className="mt-8 p-4 border rounded-xl bg-secondary/10">
              <label className="font-bold mb-2 block">
                My Digital Signature
              </label>
              <div className="flex gap-6 items-center">
                {profile.signature_url ? (
                  <img
                    src={profile.signature_url}
                    className="h-20 w-40 object-contain bg-white border rounded p-2"
                    alt="Sig"
                  />
                ) : (
                  <div className="h-20 w-40 border-2 border-dashed rounded flex items-center justify-center text-muted">
                    No Signature
                  </div>
                )}
                <label className="btn btn-secondary cursor-pointer">
                  <Upload size={16} /> Upload Signature
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleSignatureUpload}
                  />
                </label>
              </div>
            </div>
            <div className="mt-6">
              <button
                className="btn btn-primary"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                <Save size={16} /> Save Profile
              </button>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">External Signatories</div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingSignatory(null);
                  setSignatoryForm({
                    name: "",
                    designation: "",
                    signature_url: null,
                  });
                  setShowSignatoryModal(true);
                }}
              >
                <Plus size={14} /> Add New
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {signatories.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 border rounded-xl bg-secondary/5"
                >
                  <div className="flex items-center gap-4">
                    {s.signature_url ? (
                      <img
                        src={s.signature_url}
                        className="h-10 w-20 object-contain bg-white border p-1"
                        alt="sig"
                      />
                    ) : (
                      <div className="h-10 w-20 border-dashed border rounded" />
                    )}
                    <div>
                      <div className="font-bold">
                        {s.name}{" "}
                        {s.profile_id && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded ml-2">
                            USER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{s.designation}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!s.profile_id && (
                      <>
                        <button
                          className="btn btn-ghost btn-icon btn-sm text-primary"
                          onClick={() => {
                            setEditingSignatory(s);
                            setSignatoryForm({
                              name: s.name,
                              designation: s.designation,
                              signature_url: s.signature_url,
                            });
                            setShowSignatoryModal(true);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm text-danger"
                          onClick={() => handleDeleteSignatory(s.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Fiscal Years</div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFyForm({ name: "", start_date: "", end_date: "" });
                  setShowFyModal(true);
                }}
              >
                <Plus size={14} /> Add FY
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {fiscalYears.map((fy) => (
                <div
                  key={fy.id}
                  className="p-3 border rounded-xl flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold">{fy.name}</span>{" "}
                    <span className="text-muted ml-4">
                      {fy.start_date} to {fy.end_date}
                    </span>
                  </div>
                  {fy.is_current ? (
                    <span className="badge badge-success">Current</span>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentFy(fy.id)}
                    >
                      Make Current
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 5 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Activity Logs</div>
            </div>
            <div className="table-container max-h-[500px] overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>By</th>
                    <th>Table</th>
                    <th>Action</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.profiles?.full_name}</td>
                      <td className="capitalize">{log.table_name}</td>
                      <td>
                        <span
                          className={`badge ${log.action === "INSERT" ? "badge-success" : log.action === "DELETE" ? "badge-danger" : "badge-warning"}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn btn-ghost btn-icon btn-sm"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 6 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recycle Bin</div>
              <div className="text-xs text-muted">
                Items here are suspended and can be restored or permanently
                removed.
              </div>
            </div>
            <div className="mb-4 search-input-wrapper">
              <Search size={16} />
              <input
                className="input"
                placeholder="Search deleted items..."
                value={recycleSearch}
                onChange={(e) => setRecycleSearch(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
            <div className="flex flex-col gap-3">
              {filteredRecycle.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  Recycle bin is empty.
                </div>
              ) : (
                filteredRecycle.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 border rounded-xl flex items-center justify-between hover:bg-secondary/5 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-neutral text-[10px]">
                          {record.type}
                        </span>
                        <span className="font-bold">{record.name}</span>
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Deleted on:{" "}
                        {new Date(record.deleted_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary btn-sm flex items-center gap-2"
                        onClick={() => handleRestore(record)}
                        disabled={restoring === record.id}
                      >
                        <RotateCcw size={14} />{" "}
                        {restoring === record.id ? "Restoring..." : "Restore"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-danger flex items-center gap-2"
                        onClick={() => handlePermanentDelete(record)}
                      >
                        <Trash2 size={14} /> Delete Forever
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === tabs.indexOf("Loans") && settings && (
          <div className="card">
            <div className="card-header">
              <div className="card-title flex items-center gap-2">
                <Landmark size={18} /> Loan Configuration Settings
              </div>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label>Default Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={settings.default_interest_rate || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_interest_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="e.g. 12"
                />
              </div>
              <div className="input-group">
                <label>Service Charge (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={
                    settings.service_charge !== undefined
                      ? settings.service_charge
                      : 1
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      service_charge: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. 1"
                />
              </div>
              <div className="input-group">
                <label>Grace Period (Days)</label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  value={
                    settings.grace_period !== undefined
                      ? settings.grace_period
                      : ""
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      grace_period: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="e.g. 30"
                />
              </div>
              <div className="input-group">
                <label>Penalty (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={
                    settings.penalty_percent !== undefined
                      ? settings.penalty_percent
                      : ""
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      penalty_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="e.g. 2"
                />
              </div>
              <div className="input-group">
                <label>Max Loan Limit (% of Total Shares)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={settings.loan_max_percentage || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      loan_max_percentage: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="e.g. 50"
                />
              </div>
            </div>
            <div className="mt-6">
              <button
                className="btn btn-primary"
                onClick={handleSaveCompany}
                disabled={saving}
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showLayoutBuilder && (
        <div
          className="modal-overlay"
          onClick={() => setShowLayoutBuilder(false)}
        >
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "95vh",
              overflow: "hidden",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg">
                Certificate Layout Canvas Builder
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowLayoutBuilder(false);
                    console.log(JSON.stringify(coords));
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveCoords}
                  disabled={saving}
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save Coords"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div
                className="flex-1"
                style={{
                  padding: "8px 12px",
                  background: "var(--bg-secondary)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                💡 <strong>Instructions:</strong> Click and Drag the boxes over
                your layout background node sequential securely!
              </div>
              <div className="flex flex-col gap-1">
                <textarea
                  className="input text-xs font-mono"
                  style={{ height: "36px", width: "200px", resize: "none" }}
                  readOnly
                  value={JSON.stringify(coords)}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <span className="text-xs text-muted">
                  📋 Copy and Paste this configuration JSON if clicking save
                  fails node sequential!
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex justify-center bg-secondary/10 p-4 rounded-xl">
              {/* wrapper provides the dashed border WITHOUT affecting the coordinate system */}
              <div style={{ position: "relative", display: "inline-block", outline: "2px dashed #999", flexShrink: 0 }}>
              <div
                id="layout-canvas"
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                style={{
                  position: "relative",
                  width: "1000px",
                  height: "707px",
                  flexShrink: 0,
                  userSelect: "none",
                  backgroundColor: "white",
                  overflow: "hidden",
                }}
              >
                {/* Background image using <img> — identical to print page so coords match exactly */}
                {settings?.certificate_bg_url && (
                  <img
                    src={settings.certificate_bg_url}
                    alt="Certificate Background"
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none", userSelect: "none", zIndex: 1 }}
                    draggable={false}
                  />
                )}
                {/* Draggable Items */}
                {Object.entries({
                  certNo: {
                    title: "प्रमाणपत्र नं",
                    value: "३",
                    color: "#10B981",
                  },
                  district: {
                    title: "जिल्ला",
                    value: "पर्वत",
                    color: "#3B82F6",
                  },
                  municipality: {
                    title: "न.पा",
                    value: "कुश्मा",
                    color: "#3B82F6",
                  },
                  ward: { title: "वडा नं", value: "१०", color: "#3B82F6" },
                  fullName: {
                    title: "नाम",
                    value: "सुधिक्षय भण्डारी",
                    color: "#8B5CF6",
                  },
                  amountKitta: {
                    title: "ले कम्पनीको रु",
                    value: "२५०००",
                    color: "#F59E0B",
                  },
                  amountDigits: {
                    title: "रु",
                    value: "२५०००/-",
                    color: "#F59E0B",
                  },
                  amountWords: {
                    title: "अक्षरुपी",
                    value: "पच्चिस हजार",
                    color: "#F59E0B",
                  },
                  accountantSig: {
                    title: "SIGNATORY",
                    value: "ACCOUNTANT SIG",
                    color: "#EF4444",
                  },
                  directorSig: {
                    title: "SIGNATORY",
                    value: "DIRECTOR SIG",
                    color: "#EF4444",
                  },
                  presidentSig: {
                    title: "SIGNATORY",
                    value: "PRESIDENT SIG",
                    color: "#EF4444",
                  },
                  stamp: {
                    title: "STAMP",
                    value: "STAMP LOGO",
                    color: "#EF4444",
                  },
                  dateStamp: {
                    title: "मिती",
                    value: "२०८२-११-२९",
                    color: "#10B981",
                  },
                }).map(([key, item]) => {
                  const saved = coords[key] || { top: 100, left: 100 };
                  const isSig = key.includes("Sig") || key === "stamp";
                  return (
                    <div
                      key={key}
                      onMouseDown={(e) => handleDragStart(key, e)}
                      style={{
                        position: "absolute",
                        top: `${saved.top}px`,
                        left: `${saved.left}px`,
                        zIndex: draggingItem === key ? 200 : 10,
                        border:
                          draggingItem === key
                            ? "1.5px dashed #EF4444"
                            : "1px dashed #666",
                        background:
                          draggingItem === key
                            ? "rgba(239, 68, 68, 0.05)"
                            : "rgba(0,0,0,0.03)",
                        cursor: "move",
                        padding: 0,
                      }}
                    >
                      {/* Label Header badge Tag floating above */}
                      <div
                        style={{
                          position: "absolute",
                          top: "-16px",
                          left: 0,
                          fontSize: "9px",
                          background: item.color,
                          color: "white",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          whiteSpace: "nowrap",
                          userSelect: "none",
                        }}
                      >
                        {item.title}
                      </div>
                      {/* The actual content intended to match alignment render layout */}
                      <div
                        style={{
                          fontSize: isSig ? "11px" : "16px",
                          fontWeight: "bold",
                          color: "black",
                          padding: "0 2px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div> {/* outline wrapper */}
            </div>
          </div>
        </div>
      )}

      {showFyModal && (
        <div className="modal-overlay" onClick={() => setShowFyModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <h3>New Fiscal Year</h3>
            <form onSubmit={handleAddFy} className="mt-4 flex flex-col gap-4">
              <input
                className="input"
                placeholder="Name e.g. 2081/82"
                value={fyForm.name}
                onChange={(e) => setFyForm({ ...fyForm, name: e.target.value })}
              />
              <input
                type="date"
                className="input"
                value={fyForm.start_date}
                onChange={(e) =>
                  setFyForm({ ...fyForm, start_date: e.target.value })
                }
              />
              <input
                type="date"
                className="input"
                value={fyForm.end_date}
                onChange={(e) =>
                  setFyForm({ ...fyForm, end_date: e.target.value })
                }
              />
              <button className="btn btn-primary">Add Fiscal Year</button>
            </form>
          </div>
        </div>
      )}

      {showBankModal && (
        <div className="modal-overlay" onClick={() => setShowBankModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingBank ? "Edit Bank" : "Add Bank"}</h3>
            <form
              onSubmit={handleSaveBank}
              className="mt-4 flex flex-col gap-4"
            >
              <input
                className="input"
                placeholder="Bank Name"
                value={bankForm.bank_name}
                onChange={(e) =>
                  setBankForm({ ...bankForm, bank_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Account Name"
                value={bankForm.account_name}
                onChange={(e) =>
                  setBankForm({ ...bankForm, account_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Account Number"
                value={bankForm.account_number}
                onChange={(e) =>
                  setBankForm({ ...bankForm, account_number: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Initial Balance"
                type="number"
                value={bankForm.initial_balance}
                onChange={(e) =>
                  setBankForm({ ...bankForm, initial_balance: e.target.value })
                }
              />
              <button className="btn btn-primary">Save Bank</button>
            </form>
          </div>
        </div>
      )}

      {showSignatoryModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSignatoryModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {editingSignatory ? "Edit Signatory" : "Add External Signatory"}
            </h3>
            <form
              onSubmit={handleSaveSignatory}
              className="mt-4 flex flex-col gap-4"
            >
              <input
                className="input"
                placeholder="Name"
                value={signatoryForm.name}
                onChange={(e) =>
                  setSignatoryForm({ ...signatoryForm, name: e.target.value })
                }
                required
              />
              <input
                className="input"
                placeholder="Designation"
                value={signatoryForm.designation}
                onChange={(e) =>
                  setSignatoryForm({
                    ...signatoryForm,
                    designation: e.target.value,
                  })
                }
                required
              />
              <div className="p-4 border rounded-xl">
                <label className="text-sm font-bold block mb-2">
                  Signature
                </label>
                <div className="flex gap-4 items-center">
                  {signatoryForm.signature_url ? (
                    <img
                      src={signatoryForm.signature_url}
                      className="h-10 w-20 object-contain bg-white border"
                      alt="sig"
                    />
                  ) : (
                    <div className="h-10 w-20 border-dashed border" />
                  )}
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    Upload{" "}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleSignatorySignatureUpload}
                    />
                  </label>
                </div>
              </div>
              <button className="btn btn-primary">Save Signatory</button>
            </form>
          </div>
        </div>
      )}

      {showChequeModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowChequeModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <h3>Add Cheque Book</h3>
            <form
              onSubmit={handleAddChequeBook}
              className="mt-4 flex flex-col gap-4"
            >
              <input
                className="input"
                placeholder="Start No"
                type="number"
                value={chequeForm.start_no}
                onChange={(e) =>
                  setChequeForm({ ...chequeForm, start_no: e.target.value })
                }
                required
              />
              <input
                className="input"
                placeholder="End No"
                type="number"
                value={chequeForm.end_no}
                onChange={(e) =>
                  setChequeForm({ ...chequeForm, end_no: e.target.value })
                }
                required
              />
              <button className="btn btn-primary">Add Range</button>
            </form>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Details</h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setSelectedLog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <pre className="p-4 bg-secondary/20 rounded-xl overflow-auto text-xs">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {showPermanentDeleteModal && recordToDeleteForever && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setShowPermanentDeleteModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 450 }}
          >
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "var(--danger)" }}>
                Permanent Deletion
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => !saving && setShowPermanentDeleteModal(false)}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--danger)",
                  padding: "12px 16px",
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 13,
                  display: "flex",
                  gap: 12,
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <Trash2 size={16} />
                </div>
                <div>
                  <strong>WARNING:</strong> This action cannot be undone. All
                  data associated with this {recordToDeleteForever.type} will be
                  lost forever.
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
                Are you sure you want to permanently delete this record?
              </p>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <strong>Type:</strong> {recordToDeleteForever.type}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Name:</strong> {recordToDeleteForever.name}
                </div>
                <div>
                  <strong>ID:</strong> {recordToDeleteForever.id}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPermanentDeleteModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: "var(--danger)",
                  borderColor: "var(--danger)",
                }}
                onClick={confirmPermanentDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Yes, Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REUSABLE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div
          className="modal-overlay"
          onClick={() => !confirmConfig.loading && setShowConfirmModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">{confirmConfig.title}</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowConfirmModal(false)}
                disabled={confirmConfig.loading}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)" }}>
                {confirmConfig.message}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={confirmConfig.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: "var(--danger)",
                  borderColor: "var(--danger)",
                }}
                onClick={confirmConfig.onConfirm}
                disabled={confirmConfig.loading}
              >
                {confirmConfig.loading ? "Processing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
