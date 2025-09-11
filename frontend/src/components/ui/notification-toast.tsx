'use client'

import { X } from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { cn } from '@/lib/utils'

export function NotificationToast() {
  const { notifications, removeNotification } = useUIStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm",
            "animate-in slide-in-from-right-full duration-300",
            {
              "bg-green-50 border-green-200 text-green-800": notification.type === 'success',
              "bg-red-50 border-red-200 text-red-800": notification.type === 'error',
              "bg-yellow-50 border-yellow-200 text-yellow-800": notification.type === 'warning',
              "bg-blue-50 border-blue-200 text-blue-800": notification.type === 'info',
            }
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{notification.title}</p>
            {notification.message && (
              <p className="text-sm opacity-90 mt-1">{notification.message}</p>
            )}
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
