'use client'

import { Bell, Search, Sun, Moon, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/stores/auth-store'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { isAuthenticated, user, logout } = useAuthStore()
  const initials = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || (user?.email?.[0]?.toUpperCase() ?? 'U')
  const router = useRouter()
  const [search, setSearch] = useState('')

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-6 xl:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8 sm:h-10 sm:w-10"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Search Bar */}
        <div className="flex flex-1 items-center max-w-xs sm:max-w-md mx-2 sm:mx-4">
          <div className="relative w-full">
            <Search className="absolute left-2 sm:left-3 top-1/2 h-3 w-3 sm:h-4 sm:w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (search || '').trim()
                  if (q.length > 0) router.push(`/invoices?search=${encodeURIComponent(q)}`)
                }
              }}
              className="pl-7 sm:pl-10 pr-2 h-8 sm:h-10 text-xs sm:text-sm w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="text-gray-600 dark:text-gray-400 h-8 w-8 sm:h-10 sm:w-10"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>

          {/* Notifications */}
          <div className="relative hidden sm:block">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 dark:text-gray-400 h-8 w-8 sm:h-10 sm:w-10"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          {/* User */}
          {isAuthenticated && (
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
              <Link href="/settings" className="flex items-center">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 sm:px-3" onClick={() => logout()}>
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
