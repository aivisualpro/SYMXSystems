import { useQuery } from '@tanstack/react-query'
import { qk } from '../keys'

// ── Admin Users ──────────────────────────────────────────────────────────────
export function useAdminUsers() {
  return useQuery({
    queryKey: qk.admin.users,
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
    staleTime: 10 * 60_000,
  })
}

// ── Admin Roles ──────────────────────────────────────────────────────────────
export function useAdminRoles() {
  return useQuery({
    queryKey: qk.admin.roles,
    queryFn: async () => {
      const res = await fetch('/api/admin/roles')
      if (!res.ok) throw new Error('Failed to fetch roles')
      return res.json()
    },
    staleTime: 10 * 60_000,
  })
}

// ── Messaging Employees (by filter + yearWeek) ──────────────────────────────
export function useMessagingEmployees(filter: string, yearWeek: string) {
  return useQuery({
    queryKey: qk.messaging.employees(filter, yearWeek),
    queryFn: async () => {
      const res = await fetch(`/api/messaging/employees?filter=${encodeURIComponent(filter)}&yearWeek=${encodeURIComponent(yearWeek)}`)
      if (!res.ok) throw new Error(`Failed to fetch messaging employees (${filter})`)
      const raw = await res.json()
      return raw?.employees ?? []
    },
    staleTime: 3 * 60_000,
    enabled: !!yearWeek,
  })
}
