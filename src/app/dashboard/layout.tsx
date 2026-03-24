"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Receipt,
  Award,
  Calendar,
  Landmark,
  Wallet,
  Bell,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  FileText,
  PiggyBank,
  ArrowDownToLine,
  Briefcase,
  Trash2,
  BarChart,
  MessageSquareWarning,
  Banknote,
  Megaphone,
} from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  role_id?: string | null;
  roles?: {
    permissions: Record<string, boolean>;
  };
}

const navSections = [
  {
    title: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart },
      { href: "/dashboard/analytics/loans", label: "Loan Analytics", icon: Banknote },
      { href: "/dashboard/agm", label: "AGM Analytics", icon: Megaphone },
    ],
  },
  {
    title: "Management",
    links: [
      { href: "/dashboard/shareholders", label: "Shareholders", icon: Users },
      {
        href: "/dashboard/investments",
        label: "Share Collection",
        icon: TrendingUp,
      },
      { href: "/dashboard/dividends", label: "Dividends", icon: PiggyBank },
      {
        href: "/dashboard/certificates",
        label: "Share Certificates",
        icon: Award,
      },
      { href: "/dashboard/loans", label: "Loans", icon: Wallet },
      {
        href: "/dashboard/directors",
        label: "Directors (BOD)",
        icon: Briefcase,
      },
      {
        href: "/dashboard/complaints",
        label: "Complaints",
        icon: MessageSquareWarning,
      },
    ],
  },
  {
    title: "Operations",
    links: [
      {
        href: "/dashboard/company-investments",
        label: "Company Investments",
        icon: Briefcase,
      },
      { href: "/dashboard/banks", label: "Banking", icon: Landmark },
      { href: "/dashboard/petty-cash", label: "Petty Cash", icon: Wallet },
      {
        href: "/dashboard/returns",
        label: "Returns (ROI)",
        icon: ArrowDownToLine,
      },
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/meetings", label: "Board Meetings", icon: Calendar },
      {
        href: "/dashboard/chalani",
        label: "Chalani (Letters)",
        icon: FileText,
      },
      { href: "/dashboard/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    title: "System",
    links: [
      { href: "/dashboard/users", label: "User Management", icon: Users },
      { href: "/dashboard/reports", label: "Reports", icon: FileText },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/recycle-bin", label: "Recycle Bin", icon: Trash2 },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initial theme setup
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from("profiles")
        .select("*, roles:role_id(permissions)")
        .eq("id", user.id)
        .single();

      // Fallback for ANY schema mismatch error (missing column, relationship, etc.)
      if (error && error.code !== 'PGRST116') {
        const { data: legacyData, error: legacyError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
          
        if (legacyError && legacyError.code === 'PGRST116') {
          console.error("Profile not found for this user in the profiles table.");
        }
        
        data = legacyData;
      } else if (error && error.code === 'PGRST116') {
         console.error("Profile not found for this user in the profiles table.");
      }

      if (data) setProfile(data as Profile);
    };

    const fetchNotifications = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      setUnreadCount(count || 0);
    };

    fetchProfile();
    fetchNotifications();

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    // Run once on mount to handle initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [supabase]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
    router.refresh();
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "GB"
    );
  };

  const hasPermission = (href: string) => {
    if (profile?.role === "super_admin" || profile?.roles?.permissions?.all)
      return true;
    if (href === "/dashboard") return true;

    // Dynamic Permission toggle
    if (profile?.roles?.permissions) {
      const key = href.replace("/dashboard/", "");
      return profile?.roles?.permissions?.[key] === true;
    }

    // Static Role Compatibility fallback (Fallback until users do Migration in SQL Editor)
    if (profile?.role === "admin") {
      // Allow all general layout items by default
      return true;
    }

    return false;
  };

  const filteredNavSections = navSections
    .map((section) => ({
      ...section,
      links: section.links.filter((l) => hasPermission(l.href)),
    }))
    .filter((section) => section.links.length > 0);

  const isAllowedPath = hasPermission(pathname);

  return (
    <div className="app-layout" suppressHydrationWarning>
      {/* Mobile Toggle Button */}
      <button
        id="mobile-sidebar-toggle"
        className="btn btn-icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile overlay */}
      {mounted && sidebarOpen && (
        <div
          className="sidebar-overlay active"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-logo">
            <div className="sidebar-logo-icon">GB</div>
            <div>
              <div className="sidebar-logo-text">Global Bihani</div>
              <div className="sidebar-logo-sub">Investment Pvt Ltd</div>
            </div>
          </Link>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={
              theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
            }
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredNavSections.map((section) => (
            <div key={section.title} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              {section.links.map((link) => {
                const isActive =
                  link.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link ${isActive ? "active" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon />
                    <span>{link.label}</span>
                    {link.label === "Notifications" && unreadCount > 0 && (
                      <span
                        className="badge badge-danger"
                        style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          padding: "1px 6px",
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout}>
            <div className="sidebar-user-avatar">
              {profile ? getInitials(profile.full_name) : "GB"}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {profile?.full_name || "Admin User"}
              </div>
              <div className="sidebar-user-role">
                {profile?.role || "admin"}
              </div>
            </div>
            <LogOut size={16} style={{ color: "var(--text-muted)" }} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {isAllowedPath ? (
          children
        ) : (
          <div className="p-8 text-center text-muted">
            Access Denied. You do not have permissions for this module.
          </div>
        )}
      </main>
    </div>
  );
}
