import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  BarChart3,
  Activity,
  AlertCircle,
  Mail,
  Wrench,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

const adminNavigation = [
  { name: "Analytics", href: "/admin?tab=overview", tab: "overview", icon: BarChart3 },
  { name: "User Management", href: "/admin?tab=users", tab: "users", icon: Users },
  { name: "Activity Log", href: "/admin?tab=activity", tab: "activity", icon: Activity },
  { name: "Error Logs", href: "/admin?tab=errors", tab: "errors", icon: AlertCircle },
];

const adminSystemNavigation = [
  { name: "General Settings", href: "/admin/general", icon: Settings },
  { name: "Email Settings", href: "/admin/email", icon: Mail },
  { name: "Stripe Settings", href: "/admin/payments", icon: CreditCard },
  { name: "Backups", href: "/admin/backup", icon: Database },
  { name: "Maintenance", href: "/admin/maintenance", icon: Wrench },
];

const settingsLink = { name: "Settings", href: "/settings", icon: Settings };

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const homeHref = isAdmin ? "/admin?tab=overview" : "/dashboard";
  const currentAdminTab = location.pathname.startsWith("/admin/users")
    ? "users"
    : new URLSearchParams(location.search).get("tab") ?? "overview";

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-sidebar-border">
          <Link to={homeHref} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">Invoicy</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {!isAdmin ? (
            [...navigation, settingsLink].map((link) => {
              const isActive =
                location.pathname === link.href || location.pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={cn("sidebar-item", isActive && "active")}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.name}</span>
                </Link>
              );
            })
          ) : (
            <>
              <p className="px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Admin
              </p>
              {adminNavigation.map((link) => {
                const isActive =
                  location.pathname === "/admin" && (link as { tab?: string }).tab === currentAdminTab;
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={cn("sidebar-item", isActive && "active")}
                  >
                    <link.icon className="w-5 h-5" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}

              <p className="px-3 mt-6 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                System Management
              </p>
              {adminSystemNavigation.map((link) => {
                const isActive =
                  location.pathname === link.href || location.pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={cn("sidebar-item", isActive && "active")}
                  >
                    <link.icon className="w-5 h-5" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}

              <div className="pt-6">
                {(() => {
                  const link = settingsLink;
                  const isActive =
                    location.pathname === link.href || location.pathname.startsWith(link.href + "/");
                  return (
                    <Link to={link.href} className={cn("sidebar-item", isActive && "active")}>
                      <link.icon className="w-5 h-5" />
                      <span>{link.name}</span>
                    </Link>
                  );
                })()}
              </div>
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground">{fullName}</p>
                  <p className="text-xs text-sidebar-foreground/60">{user?.email || ""}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground z-50"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
                <Link to={homeHref} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                    <FileText className="w-4 h-4 text-sidebar-primary-foreground" />
                  </div>
                  <span className="text-lg font-bold">Invoicy</span>
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="px-4 py-6 space-y-1">
                {!isAdmin ? (
                  [...navigation, settingsLink].map((link) => {
                    const isActive =
                      location.pathname === link.href || location.pathname.startsWith(link.href + "/");
                    return (
                      <Link
                        key={link.name}
                        to={link.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn("sidebar-item", isActive && "active")}
                      >
                        <link.icon className="w-5 h-5" />
                        <span>{link.name}</span>
                      </Link>
                    );
                  })
                ) : (
                  <>
                    <p className="px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Admin
                    </p>
                    {adminNavigation.map((link) => {
                      const isActive =
                        location.pathname === "/admin" && (link as { tab?: string }).tab === currentAdminTab;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn("sidebar-item", isActive && "active")}
                        >
                          <link.icon className="w-5 h-5" />
                          <span>{link.name}</span>
                        </Link>
                      );
                    })}

                    <p className="px-3 mt-6 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      System Management
                    </p>
                    {adminSystemNavigation.map((link) => {
                      const isActive =
                        location.pathname === link.href || location.pathname.startsWith(link.href + "/");
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn("sidebar-item", isActive && "active")}
                        >
                          <link.icon className="w-5 h-5" />
                          <span>{link.name}</span>
                        </Link>
                      );
                    })}

                    <div className="pt-6">
                      {(() => {
                        const link = settingsLink;
                        const isActive =
                          location.pathname === link.href || location.pathname.startsWith(link.href + "/");
                        return (
                          <Link
                            to={link.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn("sidebar-item", isActive && "active")}
                          >
                            <link.icon className="w-5 h-5" />
                            <span>{link.name}</span>
                          </Link>
                        );
                      })()}
                    </div>
                  </>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Top Header */}
        <header className="h-16 lg:h-20 bg-background border-b border-border px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 -ml-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {!isAdmin && (
              <Link to="/invoices/new">
                <Button size="sm" className="hidden sm:flex">
                  <Plus className="w-4 h-4 mr-1" />
                  New Invoice
                </Button>
                <Button size="icon-sm" className="sm:hidden">
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            )}

            {/* Mobile User Avatar */}
            <div className="lg:hidden">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
