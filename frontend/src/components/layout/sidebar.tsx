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
      collapsed ? "w-20" : "w-72"
    )}>
      {/* Logo and Collapse Button */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
        <Link href={homeHref} className={cn(
          "flex items-center space-x-3 group",
          collapsed && "justify-center"
        )}>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all duration-300">
            <FileText className="h-6 w-6 text-white" />
          </div>
          {!collapsed && (
            <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{siteName || 'Invoicy'}</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 rounded-lg"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Quick Actions (hidden for admins) */}
      {!collapsed && !isAdmin && (
        <div className="px-4 py-4">
          <Button className="w-full gradient-primary hover-lift shadow-medium text-white font-semibold">
            <Plus className="h-5 w-5 mr-2" />
            New Invoice
          </Button>
        </div>
      )}

      {/* Main Navigation (non-admin only) */}
      {hasMainNavigation && (
        <nav className="flex-1 px-4 py-2 space-y-2">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
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

      {/* Admin Section (visible only for admins) */}
      {isAdmin && (
        <div className="px-3 py-0 flex-1">
          {!collapsed && hasMainNavigation && (
            <p className="px-3 mb-1 text-xs uppercase tracking-wider text-gray-400">Admin</p>
          )}
          {/* Admin Management */}
          {([
            { name: 'Analytics', href: '/admin?tab=overview', key: 'overview', icon: BarChart3, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'User Management', href: '/admin?tab=users', key: 'users', icon: Users, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Activity Log', href: '/admin?tab=activity', key: 'activity', icon: Activity, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
            { name: 'Error Logs', href: '/admin?tab=errors', key: 'errors', icon: AlertCircle, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
          ]).filter(item => item.allowedRoles.some(r => r === (user?.role ?? 'USER'))).map((item) => {
            const Icon = item.icon
            const currentAdminTab = pathname.startsWith('/admin/users')
              ? 'users'
              : (searchParams.get('tab') ?? 'overview')
            const isActive = pathname.startsWith('/admin') && currentAdminTab === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 text-white border-l-4 border-indigo-500"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  collapsed && "justify-center"
                )}
              >
                <Icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                {!collapsed && item.name}
              </Link>
            )
          })}

          {/* System Management */}
          {!collapsed && (
            <p className="px-3 mt-2 mb-1 text-xs uppercase tracking-wider text-gray-400">System Management</p>
          )}
          {([
            { name: 'System Settings', href: '/admin/settings', key: 'system', icon: Settings, allowedRoles: ['ADMIN','SUPER_ADMIN'] as const },
          ]).filter(item => item.allowedRoles.some(r => r === (user?.role ?? 'USER'))).map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 text-white border-l-4 border-indigo-500"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  collapsed && "justify-center"
                )}
              >
                <Icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                {!collapsed && item.name}
              </Link>
            )
          })}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="px-3 py-2 space-y-1 border-t border-gray-800">
        {bottomNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
              {!collapsed && item.name}
            </Link>
          )
        })}
      </div>

      {/* User Profile */}
      <div className="px-3 py-3 border-t border-gray-800">
        <div className={cn(
          "flex items-center space-x-3",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-10 w-10">
            {user?.avatar ? <AvatarImage src={user.avatar} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1">
              <p className="text-sm font-medium">{displayName}</p>
              {email ? (
                <p className="text-xs text-gray-400">{email}</p>
              ) : null}
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-gray-800"
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
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
