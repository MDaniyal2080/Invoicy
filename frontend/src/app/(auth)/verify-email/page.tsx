'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = searchParams.get('token')
    if (t) {
      // Send users to the dynamic route that performs verification and refresh
      router.replace(`/verify-email/${encodeURIComponent(t)}`)
    }
  }, [router, searchParams])

  return null
}
