"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  MessageSquareWarning,
  Plus,
  Search,
  Eye,
  Trash2,
  X,
  CheckCircle,
  Forward,
  Upload,
  User,
  CornerDownRight,
  FileText,
} from "lucide-react";
import NepaliDateInput from "../components/NepaliDateInput";
import { processImage } from "@/lib/utils/imageProcess";
import { getCurrentBsDate } from "@/lib/utils/nepaliDate";

interface Profile {
  id: string;
  full_name: string;
  designation: string | null;
  role: string | null;
}

interface Shareholder {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
}

interface Complaint {
  id: string;
  complaint_no: string;
  shareholder_id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  filed_date: string;
  due_date: string | null;
  resolved_date: string | null;
  resolution_notes: string | null;
  resolution_type: string | null;
  forwarded_to: string | null;
  forwarded_date: string | null;
  forwarded_remarks: string | null;
  attachment_url: string | null;
  assigned_to: string | null;
  created_at: string;
  deleted_at: string | null;
  shareholders?: Shareholder;
  profiles_forwarded?: Profile;
  profiles_assigned?: Profile;
}

interface Comment {
  id: string;
  complaint_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  attachment_url: string | null;
  created_at: string;
  profiles?: Profile;
}

const CATEGORIES = [
  "Dividend",
  "Share Transfer",
  "Loan",
  "Meeting",
  "Service Quality",
  "Investment",
  "Others",
];

const PRIORITIES = [
  {
    value: "low",
    label: "Low",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  {
    value: "high",
    label: "High",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  {
    value: "critical",
    label: "Critical",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
  },
];

const RESOLUTION_TYPES = ["Resolved", "Rejected", "Dismissed", "Withdrawn"];

export default function ComplaintsPage() {
  const supabase = createClient();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // States
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null,
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
  const [isInternalComment, setIsInternalComment] = useState(false);

  const [form, setForm] = useState({
    shareholder_id: "",
    subject: "",
    description: "",
    category: CATEGORIES[0],
    priority: "medium",
    filed_date: getCurrentBsDate(),
    due_date: "",
    assigned_to: "",
    attention_user: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const [forwardForm, setForwardForm] = useState({
    forwarded_to: "",
    forwarded_remarks: "",
  });

  const [closeForm, setCloseForm] = useState({
    resolution_type: RESOLUTION_TYPES[0],
    resolution_notes: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user);

    const [compRes, shRes, profRes] = await Promise.all([
      supabase
        .from("complaints")
        .select(
          `
        *,
        shareholders ( id, first_name, last_name, phone_number ),
        profiles_forwarded:forwarded_to ( id, full_name, designation, role ),
        profiles_assigned:assigned_to ( id, full_name, designation, role )
      `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("shareholders")
        .select("id, first_name, last_name, phone_number")
        .is("deleted_at", null),
      supabase.from("profiles").select("id, full_name, designation, role"),
    ]);

    setComplaints(compRes.data || []);
    setShareholders(shRes.data || []);
    setProfiles(profRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchComments = async (complaintId: string) => {
    try {
      // 1. Fetch raw comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("complaint_comments")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true });
      
      if (commentsError) throw commentsError;

      // 2. Fetch profiles for these users
      const userIds = Array.from(new Set(commentsData.map(c => c.user_id)));
      let profilesMap: Record<string, Profile> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, designation, role")
          .in("id", userIds);
          
        if (profilesData) {
          profilesData.forEach(p => profilesMap[p.id] = p);
        }
      }

      // 3. Merge them
      const mergedComments = commentsData.map(c => ({
        ...c,
        profiles: profilesMap[c.user_id]
      }));

      setComments(mergedComments);
    } catch (err: any) {
      console.error("fetchComments error:", err);
      toast.error(`Discussion error: ${err.message}`);
    }
  };

  const uploadFile = async (f: File, pathPrefix: string) => {
    const fileName = `${pathPrefix}-${Date.now()}.webp`;
    const processed = await processImage(f);
    const { error } = await supabase.storage
      .from("documents")
      .upload(fileName, processed);
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName);
    return publicUrl;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    try {
      let attachment_url = null;
      if (file) {
        attachment_url = await uploadFile(file, "complaint");
      }

      const { error } = await supabase.from("complaints").insert({
        shareholder_id: form.shareholder_id,
        subject: form.subject,
        description: form.description,
        category: form.category,
        priority: form.priority,
        filed_date: form.filed_date,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
        attachment_url,
        created_by: currentUser.id,
      });

      if (error) throw error;
      toast.success("Complaint registered successfully");
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create complaint");
    } finally {
      setSaving(false);
    }
  };

  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !currentUser) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("complaints")
        .update({
          status: "forwarded",
          forwarded_to: forwardForm.forwarded_to,
          forwarded_remarks: forwardForm.forwarded_remarks,
          forwarded_date: getCurrentBsDate(),
        })
        .eq("id", selectedComplaint.id);

      if (error) throw error;
      toast.success("Complaint forwarded successfully");

      // Auto-add system note to thread
      await supabase.from("complaint_comments").insert({
        complaint_id: selectedComplaint.id,
        user_id: currentUser.id,
        comment: `System: Escalated/Forwarded. Remarks: ${forwardForm.forwarded_remarks}`,
        is_internal: true,
      });

      setShowForwardModal(false);
      fetchData();
      if (showDetailModal) {
        setSelectedComplaint((prev) =>
          prev ? { ...prev, status: "forwarded" } : null,
        );
        fetchComments(selectedComplaint.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to forward complaint");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !currentUser) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("complaints")
        .update({
          status: "closed",
          resolution_type: closeForm.resolution_type,
          resolution_notes: closeForm.resolution_notes,
          resolved_date: getCurrentBsDate(),
        })
        .eq("id", selectedComplaint.id);

      if (error) throw error;
      toast.success("Complaint closed successfully");

      // Auto-add system note
      await supabase.from("complaint_comments").insert({
        complaint_id: selectedComplaint.id,
        user_id: currentUser.id,
        comment: `System: Marked as Closed (${closeForm.resolution_type}). Resolution: ${closeForm.resolution_notes}`,
        is_internal: false,
      });

      setShowCloseModal(false);
      fetchData();
      if (showDetailModal) {
        setSelectedComplaint((prev) =>
          prev ? { ...prev, status: "closed" } : null,
        );
        fetchComments(selectedComplaint.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to close complaint");
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() && !commentAttachment) return;
    if (!selectedComplaint || !currentUser) return;
    setSaving(true);

    try {
      let attachment_url = null;
      if (commentAttachment) {
        attachment_url = await uploadFile(commentAttachment, "comment");
      }

      const { error } = await supabase.from("complaint_comments").insert({
        complaint_id: selectedComplaint.id,
        user_id: currentUser.id,
        comment: newComment,
        attachment_url,
        is_internal: isInternalComment,
      });

      if (error) throw error;
      setNewComment("");
      setCommentAttachment(null);
      await fetchComments(selectedComplaint.id);
      toast.success("Update posted");
    } catch (err: any) {
      console.error("submitComment error:", err);
      toast.error(err?.message || "Failed to post update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedComplaint) return;
    setSaving(true);
    const { error } = await supabase
      .from("complaints")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selectedComplaint.id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Moved to recycle bin");
      fetchData();
      setShowConfirmModal(false);
      setShowDetailModal(false);
    }
    setSaving(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <span className="badge badge-success">Open</span>;
      case "forwarded":
        return <span className="badge badge-warning">Forwarded</span>;
      case "closed":
        return <span className="badge badge-neutral">Closed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getPriorityBadge = (val: string) => {
    const p = PRIORITIES.find((x) => x.value === val);
    if (!p) return null;
    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.color}`}
      >
        {p.label}
      </span>
    );
  };

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const shName =
        `${c.shareholders?.first_name} ${c.shareholders?.last_name}`.toLowerCase();
      if (
        !c.complaint_no.toLowerCase().includes(term) &&
        !shName.includes(term) &&
        !c.subject.toLowerCase().includes(term)
      )
        return false;
    }
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaint Management</h1>
          <p className="page-subtitle">
            Track and resolve shareholder grievances
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({ ...form, filed_date: getCurrentBsDate() });
            setFile(null);
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} /> Filter Complaint
        </button>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
            <div className="search-input-wrapper w-full md:w-96">
              <Search size={16} />
              <input
                className="input"
                placeholder="Search by ID, Name or Subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <button
                className={`btn btn-sm whitespace-nowrap ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                className={`btn btn-sm whitespace-nowrap ${statusFilter === "open" ? "btn-success text-white" : "btn-secondary"}`}
                onClick={() => setStatusFilter("open")}
              >
                Open
              </button>
              <button
                className={`btn btn-sm whitespace-nowrap ${statusFilter === "forwarded" ? "btn-warning text-white" : "btn-secondary"}`}
                onClick={() => setStatusFilter("forwarded")}
              >
                Forwarded
              </button>
              <button
                className={`btn btn-sm whitespace-nowrap ${statusFilter === "closed" ? "btn-neutral text-white" : "btn-secondary"}`}
                onClick={() => setStatusFilter("closed")}
              >
                Closed
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref No.</th>
                  <th>Shareholder</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date Filed</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted p-8">
                      No complaints found.
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium whitespace-nowrap">
                        {c.complaint_no}
                      </td>
                      <td>
                        <div className="font-bold">
                          {c.shareholders?.first_name}{" "}
                          {c.shareholders?.last_name}
                        </div>
                        <div className="text-xs text-muted">
                          {c.shareholders?.phone_number}
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate" title={c.subject}>
                        <div className="font-medium truncate">{c.subject}</div>
                        <div className="text-xs text-muted truncate">
                          {c.category}
                        </div>
                      </td>
                      <td>{getPriorityBadge(c.priority)}</td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td className="whitespace-nowrap">{c.filed_date}</td>
                      <td className="text-right">
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => {
                            setSelectedComplaint(c);
                            fetchComments(c.id);
                            setShowDetailModal(true);
                          }}
                        >
                          <Eye size={16} className="text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2">
                <MessageSquareWarning size={20} /> Register New Complaint
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>
                      Shareholder <span className="text-danger">*</span>
                    </label>
                    <select
                      className="input"
                      required
                      value={form.shareholder_id}
                      onChange={(e) =>
                        setForm({ ...form, shareholder_id: e.target.value })
                      }
                    >
                      <option value="">Select Shareholder</option>
                      {shareholders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} ({s.phone_number || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group md:col-span-2">
                    <label>
                      Subject <span className="text-danger">*</span>
                    </label>
                    <input
                      className="input"
                      required
                      value={form.subject}
                      onChange={(e) =>
                        setForm({ ...form, subject: e.target.value })
                      }
                      placeholder="Brief summary of the issue"
                    />
                  </div>

                  <div className="input-group col-span-1 md:col-span-2">
                    <label>
                      Detailed Description <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="input"
                      required
                      rows={4}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Full details provided by the shareholder..."
                    />
                  </div>

                  <div className="input-group">
                    <label>
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      className="input"
                      required
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>
                      Priority <span className="text-danger">*</span>
                    </label>
                    <select
                      className="input"
                      required
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>
                      Filed Date (BS) <span className="text-danger">*</span>
                    </label>
                    <NepaliDateInput
                      value={form.filed_date}
                      onChange={(v) => setForm({ ...form, filed_date: v })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Due Date (BS)</label>
                    <NepaliDateInput
                      value={form.due_date}
                      onChange={(v) => setForm({ ...form, due_date: v })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Assign To (Staff/User)</label>
                    <select
                      className="input"
                      value={form.assigned_to}
                      onChange={(e) =>
                        setForm({ ...form, assigned_to: e.target.value })
                      }
                    >
                      <option value="">-- Unassigned --</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Attachment/Evidence (Optional)</label>
                    <input
                      className="input"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Register Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedComplaint && (
        <div className="modal-overlay" style={{ alignItems: 'center', paddingTop: 0 }} onClick={() => setShowDetailModal(false)}>
          <div style={{ width: '92%', maxWidth: 1040, height: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 16, background: 'var(--bg-primary)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{selectedComplaint.complaint_no}</span>
                  {getStatusBadge(selectedComplaint.status)}
                  {getPriorityBadge(selectedComplaint.priority)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedComplaint.subject}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDetailModal(false)}><X size={20} /></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* Left — Details */}
              <div style={{ width: '45%', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><User size={13} /> Shareholder</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{selectedComplaint.shareholders?.first_name} {selectedComplaint.shareholders?.last_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📞 {selectedComplaint.shareholders?.phone_number || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>{selectedComplaint.description}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Category</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedComplaint.category}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Filed Date</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedComplaint.filed_date}</div>
                  </div>
                </div>
                {(selectedComplaint.status === 'forwarded' || selectedComplaint.forwarded_to) && (
                  <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Forward size={13} /> Escalation</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>To: {selectedComplaint.profiles_forwarded?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Date: {selectedComplaint.forwarded_date}</div>
                    {selectedComplaint.forwarded_remarks && <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(234,179,8,0.2)' }}>"{selectedComplaint.forwarded_remarks}"</div>}
                  </div>
                )}
                {selectedComplaint.status === 'closed' && (
                  <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={13} /> Resolution</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedComplaint.resolution_type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Resolved: {selectedComplaint.resolved_date}</div>
                    {selectedComplaint.resolution_notes && <div style={{ fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(34,197,94,0.15)', whiteSpace: 'pre-wrap' }}>{selectedComplaint.resolution_notes}</div>}
                  </div>
                )}
                {selectedComplaint.attachment_url && (
                  <a href={selectedComplaint.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, background: 'var(--bg-secondary)' }}>
                    <FileText size={18} /> View Attachment
                  </a>
                )}
              </div>


              {/* Right — Discussion Thread */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquareWarning size={16} style={{ color: 'var(--primary)' }} /> Discussion Thread
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>{comments.length} updates</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>No updates or comments yet.</div>
                  ) : comments.map((c) => {
                    const isSystem = c.comment.startsWith('System:');
                    return (
                      <div key={c.id} style={{ background: isSystem ? 'transparent' : c.is_internal ? 'rgba(251,191,36,0.08)' : 'var(--bg-primary)', border: `1px ${isSystem ? 'dashed' : 'solid'} ${c.is_internal ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', marginLeft: isSystem ? 20 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.profiles?.full_name || 'User'}
                            {c.is_internal && <span style={{ fontSize: 9, background: 'rgba(251,191,36,0.3)', color: '#92400e', padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase' }}>Internal</span>}
                            {isSystem && <span style={{ fontSize: 9, background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase' }}>System</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: isSystem ? 'var(--text-muted)' : 'var(--text-primary)', fontStyle: isSystem ? 'italic' : 'normal' }}>
                          {isSystem ? c.comment.replace('System: ', '') : c.comment}
                        </div>
                        {c.attachment_url && (
                          <a href={c.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--primary)', textDecoration: 'none', background: 'var(--bg-secondary)' }}>
                            <FileText size={12} /> Attachment
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedComplaint.status !== 'closed' && (
                  <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                    {commentAttachment && (
                      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)' }}>
                        {commentAttachment.type.startsWith('image/') ? (
                           <img src={URL.createObjectURL(commentAttachment)} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: 48, height: 48, background: 'var(--bg-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={20} /></div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commentAttachment.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(commentAttachment.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCommentAttachment(null)}><X size={14} /></button>
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 10 }}>
                      <input type="checkbox" checked={isInternalComment} onChange={(e) => setIsInternalComment(e.target.checked)} />
                      <span style={{ color: isInternalComment ? '#b45309' : 'var(--text-muted)', fontWeight: isInternalComment ? 600 : 400 }}>Mark as internal note (Staff only)</span>
                    </label>
                    <textarea className="input" style={{ width: '100%', minHeight: 76, padding: '10px 12px', fontSize: 13, resize: 'vertical', borderColor: isInternalComment ? 'rgba(234,179,8,0.5)' : undefined, background: isInternalComment ? 'rgba(251,191,36,0.05)' : undefined }}
                      placeholder={isInternalComment ? 'Type an internal note...' : 'Add a comment or update...'}
                      value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <Upload size={14} />
                        <span>Attach File</span>
                        <input type="file" style={{ display: 'none' }} onChange={(e) => setCommentAttachment(e.target.files?.[0] || null)} />
                      </label>
                      <button className="btn btn-primary btn-sm" onClick={submitComment} disabled={saving || (!newComment.trim() && !commentAttachment)}>
                        {saving ? 'Posting...' : 'Post Update'} {!saving && <CornerDownRight size={14} style={{ marginLeft: 4 }} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action bar */}
            <div style={{ padding: '12px 20px', background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.18)', color: '#f87171', border: 'none', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }} onClick={() => setShowConfirmModal(true)}>
                <Trash2 size={14} /> Delete
              </button>
              {selectedComplaint.status !== 'closed' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.2)', color: '#fbbf24', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    onClick={() => { setForwardForm({ forwarded_to: '', forwarded_remarks: '' }); setShowForwardModal(true); }}>
                    <Forward size={14} /> Escalate / Forward
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    onClick={() => { setCloseForm({ resolution_type: RESOLUTION_TYPES[0], resolution_notes: '' }); setShowCloseModal(true); }}>
                    <CheckCircle size={14} /> Resolve and Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
  
      )}

      {/* FORWARD MODAL */}
      {showForwardModal && (
        <div className="modal-overlay z-[100]" onClick={() => !saving && setShowForwardModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2 text-warning">
                <Forward size={18} /> Forward Complaint
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowForwardModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleForward}>
              <div className="modal-body flex flex-col gap-4">
                <div className="input-group">
                  <label>
                    Select User/Authority to Forward To{" "}
                    <span className="text-danger">*</span>
                  </label>
                  <select
                    className="input"
                    required
                    value={forwardForm.forwarded_to}
                    onChange={(e) =>
                      setForwardForm({
                        ...forwardForm,
                        forwarded_to: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Select Authority --</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.designation || p.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>
                    Remarks / Instructions <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="input"
                    required
                    rows={3}
                    value={forwardForm.forwarded_remarks}
                    onChange={(e) =>
                      setForwardForm({
                        ...forwardForm,
                        forwarded_remarks: e.target.value,
                      })
                    }
                    placeholder="Why is this being escalated?"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForwardModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary bg-warning border-warning text-yellow-950 hover:bg-yellow-500 hover:border-yellow-500"
                  disabled={saving}
                >
                  {saving ? "Forwarding..." : "Confirm Forward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE MODAL */}
      {showCloseModal && (
        <div className="modal-overlay z-[100]" onClick={() => !saving && setShowCloseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2 text-success">
                <CheckCircle size={18} /> Close Complaint
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCloseModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleClose}>
              <div className="modal-body flex flex-col gap-4">
                <div className="input-group">
                  <label>
                    Resolution Action <span className="text-danger">*</span>
                  </label>
                  <select
                    className="input"
                    required
                    value={closeForm.resolution_type}
                    onChange={(e) =>
                      setCloseForm({
                        ...closeForm,
                        resolution_type: e.target.value,
                      })
                    }
                  >
                    {RESOLUTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>
                    Resolution Notes / Final Decision{" "}
                    <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="input"
                    required
                    rows={4}
                    value={closeForm.resolution_notes}
                    onChange={(e) =>
                      setCloseForm({
                        ...closeForm,
                        resolution_notes: e.target.value,
                      })
                    }
                    placeholder="Detail how the issue was resolved..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCloseModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success text-white"
                  disabled={saving}
                >
                  {saving ? "Closing..." : "Close Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay z-[100]" onClick={() => !saving && setShowConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2 text-danger">
                <Trash2 size={20} /> Move to Recycle Bin
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowConfirmModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body p-6 text-center">
              <p className="mb-6 text-muted">
                Are you sure you want to delete this complaint? It will be moved
                to the recycle bin and can be restored later.
              </p>
              <div className="flex gap-2 justify-center w-full">
                <button
                  className="btn btn-secondary flex-1 justify-center"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger flex-1 justify-center"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
