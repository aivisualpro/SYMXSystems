import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '../keys'
import { makeOptimisticMutation } from '../optimistic'

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

// ── Upsert User (create or update) ──────────────────────────────────────────
export function useUpsertUser() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id?: string; data: any }>(
      {
        mutationFn: async ({ id, data }) => {
          const url = id ? `/api/admin/users/${id}` : '/api/admin/users'
          const method = id ? 'PUT' : 'POST'
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Failed to save user')
          return res.json()
        },
        queryKey: qk.admin.users,
        updater: (old: any, { id, data }) => {
          if (!Array.isArray(old)) return old
          if (id) {
            return old.map((u: any) => (u._id === id ? { ...u, ...data } : u))
          }
          return [...old, { _id: `temp-${Date.now()}`, ...data }]
        },
        successMsg: 'User saved',
        errorMsg: 'Failed to save user',
      },
      qc,
    ),
  )
}

// ── Delete User ─────────────────────────────────────────────────────────────
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string }>(
      {
        mutationFn: async ({ id }) => {
          const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete user')
          return res.json()
        },
        queryKey: qk.admin.users,
        updater: (old: any, { id }) => {
          if (!Array.isArray(old)) return old
          return old.filter((u: any) => u._id !== id)
        },
        successMsg: 'User deleted',
        errorMsg: 'Failed to delete user',
      },
      qc,
    ),
  )
}

// ── Toggle User Active ─────────────────────────────────────────────────────
export function useToggleUserActive() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string; isActive: boolean }>(
      {
        mutationFn: async ({ id, isActive }) => {
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive }),
          })
          if (!res.ok) throw new Error('Failed to update status')
          return res.json()
        },
        queryKey: qk.admin.users,
        updater: (old: any, { id, isActive }) => {
          if (!Array.isArray(old)) return old
          return old.map((u: any) => (u._id === id ? { ...u, isActive } : u))
        },
        successMsg: undefined, // Silent — UI toggle IS the feedback
        errorMsg: 'Failed to update user status',
      },
      qc,
    ),
  )
}
