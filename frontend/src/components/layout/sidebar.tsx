'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Activity,
  AlertCircle,
  Mail,
  Wrench,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import { useUIStore } from '@/lib/stores/ui-store'
import apiClient from '@/lib/api-client'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
]

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const siteName = useUIStore(s => s.siteName)
  const setSiteName = useUIStore(s => s.setSiteName)
  
  // Derive display values from authenticated user
  const displayName = user
    ? ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email)
    : 'Account'
  const email = user?.email ?? ''
  const initials = user
    ? (((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || (user.email?.[0]?.toUpperCase() ?? '?'))
    : '?'

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const mainNavigation = isAdmin ? [] : navigation
  const hasMainNavigation = mainNavigation.length > 0
  const homeHref = isAdmin ? '/admin?tab=overview' : '/dashboard'

  // Load site name once for branding
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cfg = await apiClient.getPublicConfig()
        if (mounted && cfg?.siteName) setSiteName(cfg.siteName)
      } catch {}
    })()
    return () => { mounted = false }
  }, [setSiteName])

  return (
    <div className={cn(
      "relative flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-300 shadow-large border-r border-white/10",
      collapsed ? "w-16 sm:w-20" : "w-64 sm:w-72"
    )}>
      {/* Logo and Collapse Button */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
        <Link href={homeHref} className={cn(
          "flex items-center space-x-2 sm:space-x-3 group",
          collapsed && "justify-center"
        )}>
          <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all duration-300">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          {!collapsed && (
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{siteName || 'Invoicy'}</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 rounded-lg h-8 w-8 sm:h-10 sm:w-10"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
      {/* Quick Actions (hidden for admins) */}
      {!collapsed && !isAdmin && (
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          <Button className="w-full gradient-primary hover-lift shadow-medium text-white font-semibold text-sm sm:text-base h-10 sm:h-12">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="hidden xs:inline">New Invoice</span>
            <span className="xs:hidden">New</span>
          </Button>
        </div>
      )}

      {/* Main Navigation (non-admin only) */}
      {hasMainNavigation && (
        <nav className="flex-1 px-2 sm:px-4 py-2 space-y-1 sm:space-y-2">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-soft border-l-2 sm:border-l-4 border-primary"
                    : "text-white/70 hover:bg-white/10 hover:text-white hover:shadow-soft",
                  collapsed && "justify-center px-2 sm:px-3"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-md sm:rounded-lg p-1 sm:p-2 transition-all duration-200",
                  isActive 
                    ? "bg-white/20" 
                    : "group-hover:bg-white/10"
                )}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                {!collapsed && (
                  <span className="ml-2 sm:ml-3 text-xs sm:text-sm">{item.name}</span>
                )}
                {isActive && !collapsed && (
                  <div className="absolute right-3 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                )}
              </Link>
            )
          })}
        </nav>
      )}

      {/* Admin Section (visible only for admins) */}
      {isAdmin && (
        <nav className="flex-1 px-2 sm:px-4 py-2 space-y-1 sm:space-y-2">
          {!collapsed && (
            <p className="px-2 sm:px-3 mb-2 sm:mb-3 text-xs uppercase tracking-wider text-white/50 font-semibold">Admin</p>
          )}
          {/* Admin Management */}
          { ([
            { name: 'Analytics', href: '/admin?tab=overview', key: 'overview', icon: BarChart3, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'User Management', href: '/admin?tab=users', key: 'users', icon: Users, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Activity Log', href: '/admin?tab=activity', key: 'activity', icon: Activity, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Error Logs', href: '/admin?tab=errors', key: 'errors', icon: AlertCircle, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
          ]).filter(item => item.allowedRoles.some(r => r === (user?.role ?? 'USER'))).map((item) => {
            const Icon = item.icon
            const currentAdminTab = pathname.startsWith('/admin/users')
              ? 'users'
              : (searchParams.get('tab') ?? 'overview')
            const isAdminUsersRoute = pathname.startsWith('/admin/users')
            const isActive = (
              (pathname === '/admin' && currentAdminTab === item.key) ||
              (isAdminUsersRoute && item.key === 'users')
            )
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-soft border-l-4 border-primary"
                    : "text-white/70 hover:bg-white/10 hover:text-white hover:shadow-soft",
                  collapsed && "justify-center px-3"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-lg p-2 transition-all duration-200",
                  isActive 
                    ? "bg-white/20" 
                    : "group-hover:bg-white/10"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                {!collapsed && (
                  <span className="ml-3">{item.name}</span>
                )}
                {isActive && !collapsed && (
                  <div className="absolute right-3 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                )}
              </Link>
            )
          })}

          {/* System Management */}
          {!collapsed && (
            <p className="px-2 sm:px-3 mt-4 sm:mt-6 mb-2 sm:mb-3 text-xs uppercase tracking-wider text-white/50 font-semibold">System Management</p>
          )}
          {([
            { name: 'General Settings', href: '/admin/general', key: 'general', icon: Settings, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Email Settings', href: '/admin/email', key: 'email', icon: Mail, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Payment Config', href: '/admin/payments', key: 'payments', icon: CreditCard, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Backups', href: '/admin/backup', key: 'backup', icon: Database, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Maintenance', href: '/admin/maintenance', key: 'maintenance', icon: Wrench, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
          ]).filter(item => item.allowedRoles.some(r => r === (user?.role ?? 'USER'))).map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-soft border-l-4 border-primary"
                    : "text-white/70 hover:bg-white/10 hover:text-white hover:shadow-soft",
                  collapsed && "justify-center px-3"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-lg p-2 transition-all duration-200",
                  isActive 
                    ? "bg-white/20" 
                    : "group-hover:bg-white/10"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                {!collapsed && (
                  <span className="ml-3">{item.name}</span>
                )}
                {isActive && !collapsed && (
                  <div className="absolute right-3 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                )}
              </Link>
            )
          })}
        </nav>
      )}

      {/* Bottom Navigation */}
      <div className="px-2 sm:px-3 py-2 space-y-1 border-t border-gray-800">
        {bottomNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", !collapsed && "mr-2 sm:mr-3")} />
              {!collapsed && item.name}
            </Link>
          )
        })}
      </div>
      </div>

      {/* User Profile */}
      <div className="px-2 sm:px-3 py-2 sm:py-3 border-t border-gray-800">
        <div className={cn(
          "flex items-center space-x-2 sm:space-x-3",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
            {user?.avatar ? <AvatarImage src={user.avatar} /> : null}
            <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">{displayName}</p>
              {email ? (
                <p className="text-xs text-gray-400 truncate">{email}</p>
              ) : null}
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-gray-800 h-7 w-7 sm:h-8 sm:w-8"
              onClick={async () => {
                try {
                  await logout()
                  toast.success('Logged out successfully')
                  router.replace('/login')
                } catch {
                  toast.error('Failed to logout')
                }
              }}
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
