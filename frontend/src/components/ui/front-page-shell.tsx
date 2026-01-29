"use client"

import * as React from "react"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

const MODERN_DARK_PALETTE = ["#0f0c29", "#302b63", "#24243e", "#ffffff"] as const

export function FrontPalette({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-4 gap-3 motion-safe:animate-fade-in", className)}>
      {MODERN_DARK_PALETTE.map((hex) => (
        <div key={hex} className="group space-y-2">
          <div className="h-12 w-full rounded-xl border border-slate-200 bg-white p-1 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
            <div
              className="h-full w-full rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
              style={{ backgroundColor: hex }}
            />
          </div>
          <div className="text-center text-[11px] font-semibold text-slate-700/90 transition-colors group-hover:text-slate-900">
            {hex}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FrontInfoCallout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] px-4 py-3 text-sm text-white shadow-lg shadow-indigo-500/20 transition-transform duration-200 before:pointer-events-none before:absolute before:inset-y-0 before:left-[-40%] before:w-[40%] before:bg-white/20 before:blur-xl before:opacity-0 before:content-[''] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/25 hover:before:opacity-100 hover:before:animate-shimmer",
        className
      )}
    >
      {children}
    </div>
  )
}

export function useFrontPageLightMode(enabled: boolean = true) {
  const previous = useRef<{ hadDark: boolean; colorScheme: string }>({ hadDark: false, colorScheme: "" })

  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    const hadDark = root.classList.contains("dark")
    const colorScheme = root.style.colorScheme || ""
    previous.current = { hadDark, colorScheme }
    root.classList.remove("dark")
    root.style.colorScheme = "light"
    return () => {
      const next = previous.current
      if (next.hadDark) root.classList.add("dark")
      else root.classList.remove("dark")
      root.style.colorScheme = next.colorScheme
    }
  }, [enabled])
}

export function FrontPageShell({
  title,
  description,
  children,
  className,
  contentClassName,
  headerClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
}) {
  useFrontPageLightMode(true)

  return (
    <div className="min-h-screen bg-front-page flex justify-center p-4 motion-safe:animate-fade-in sm:items-center sm:p-6">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-white text-slate-900 shadow-xl transition-transform duration-300 motion-safe:animate-fade-in-up hover:-translate-y-1 hover:shadow-2xl",
          className
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden px-6 py-10 text-center text-white bg-front-gradient after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)] after:opacity-0 after:transition-opacity hover:after:opacity-100",
            headerClassName
          )}
        >
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm text-white/80">{description}</p> : null}
        </div>
        <div
          className={cn(
            "px-6 py-6 text-slate-900 motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms] motion-safe:[animation-fill-mode:backwards]",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
