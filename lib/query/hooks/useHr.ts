import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '../keys'
import { makeOptimisticMutation } from '../optimistic'

// ── HR Dashboard Stats ───────────────────────────────────────────────────────
export function useHrDashboard() {
  return useQuery({
    queryKey: qk.hr.dashboard,
    queryFn: async () => {
      const res = await fetch('/api/admin/employees/dashboard')
      if (!res.ok) throw new Error('Failed to fetch HR dashboard')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Tickets ───────────────────────────────────────────────────────────────
export function useHrTickets() {
  return useQuery({
    queryKey: qk.hr.tickets,
    queryFn: async () => {
      const res = await fetch('/api/admin/hr-tickets')
      if (!res.ok) throw new Error('Failed to fetch HR tickets')
      const raw = await res.json()
      return Array.isArray(raw) ? raw : raw?.records ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Claims ────────────────────────────────────────────────────────────────
export function useHrClaims() {
  return useQuery({
    queryKey: qk.hr.claims,
    queryFn: async () => {
      const res = await fetch('/api/admin/claims?skip=0&limit=50')
      if (!res.ok) throw new Error('Failed to fetch claims')
      const raw = await res.json()
      return {
        records: raw?.records ?? raw ?? [],
        totalCount: raw?.totalCount ?? 0,
        hasMore: raw?.hasMore ?? false,
        kpi: raw?.kpi ?? null,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Claims KPI (lightweight) ──────────────────────────────────────────────
export function useHrClaimsKpi() {
  return useQuery({
    queryKey: qk.hr.claimsKpi,
    queryFn: async () => {
      const res = await fetch('/api/admin/claims?skip=0&limit=1')
      if (!res.ok) throw new Error('Failed to fetch claims KPI')
      const raw = await res.json()
      return raw?.kpi || null
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Reimbursements ────────────────────────────────────────────────────────
export function useHrReimbursements() {
  return useQuery({
    queryKey: qk.hr.reimbursements,
    queryFn: async () => {
      const res = await fetch('/api/admin/reimbursements?skip=0&limit=50')
      if (!res.ok) throw new Error('Failed to fetch reimbursements')
      const raw = await res.json()
      return {
        records: raw?.records ?? raw ?? [],
        totalCount: raw?.totalCount ?? 0,
        hasMore: raw?.hasMore ?? false,
        kpi: raw?.kpi ?? null,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Reimbursements KPI ────────────────────────────────────────────────────
export function useHrReimbursementsKpi() {
  return useQuery({
    queryKey: qk.hr.reimbursementsKpi,
    queryFn: async () => {
      const res = await fetch('/api/admin/reimbursements?skip=0&limit=1')
      if (!res.ok) throw new Error('Failed to fetch reimbursements KPI')
      const raw = await res.json()
      return raw?.kpi || null
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Audit (employee document compliance) ──────────────────────────────────
export function useHrAudit() {
  return useQuery({
    queryKey: qk.hr.audit,
    queryFn: async () => {
      const res = await fetch('/api/admin/employees?filter=audit&export=true&terminated=false&select=firstName,lastName,transporterId,dlExpiration,offerLetterFile,handbookFile,driversLicenseFile,i9File,drugTestFile,type,phoneNumber,profileImage,status')
      if (!res.ok) throw new Error('Failed to fetch audit data')
      const raw = await res.json()
      return Array.isArray(raw) ? raw : raw?.records ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Interviews ────────────────────────────────────────────────────────────
export function useHrInterviews() {
  return useQuery({
    queryKey: qk.hr.interviews,
    queryFn: async () => {
      const res = await fetch('/api/admin/interviews')
      if (!res.ok) throw new Error('Failed to fetch interviews')
      const raw = await res.json()
      return Array.isArray(raw) ? raw : raw?.records ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ── HR Terminations ──────────────────────────────────────────────────────────
export function useHrTerminations() {
  return useQuery({
    queryKey: qk.hr.terminations,
    queryFn: async () => {
      const res = await fetch('/api/admin/employees?skip=0&limit=50&terminated=true&status=Terminated')
      if (!res.ok) throw new Error('Failed to fetch terminations')
      const raw = await res.json()
      return {
        records: raw?.records ?? raw ?? [],
        totalCount: raw?.totalCount ?? 0,
        hasMore: raw?.hasMore ?? false,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── Employees List (active, for timesheet etc.) ──────────────────────────────
export function useEmployeesList() {
  return useQuery({
    queryKey: qk.employees.all,
    queryFn: async () => {
      const res = await fetch('/api/admin/employees?skip=0&limit=500&terminated=false')
      if (!res.ok) throw new Error('Failed to fetch employees')
      const raw = await res.json()
      return raw?.records ?? raw ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  MUTATION HOOKS
// ══════════════════════════════════════════════════════════════════════════════

// ── Upsert HR Ticket ────────────────────────────────────────────────────────
export function useUpsertTicket() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id?: string; data: any }>(
      {
        mutationFn: async ({ id, data }) => {
          const url = id ? `/api/admin/hr-tickets/${id}` : '/api/admin/hr-tickets'
          const method = id ? 'PUT' : 'POST'
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Failed to save ticket')
          return res.json()
        },
        queryKey: qk.hr.tickets,
        updater: (old: any, { id, data }) => {
          if (!Array.isArray(old)) return old
          if (id) return old.map((t: any) => (t._id === id ? { ...t, ...data } : t))
          return [{ _id: `temp-${Date.now()}`, ...data }, ...old]
        },
        successMsg: 'Ticket saved',
        errorMsg: 'Failed to save ticket',
        extraInvalidateKeys: [qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Delete HR Ticket ────────────────────────────────────────────────────────
export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string }>(
      {
        mutationFn: async ({ id }) => {
          const res = await fetch(`/api/admin/hr-tickets/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete ticket')
          return res.json()
        },
        queryKey: qk.hr.tickets,
        updater: (old: any, { id }) => {
          if (!Array.isArray(old)) return old
          return old.filter((t: any) => t._id !== id)
        },
        successMsg: 'Ticket deleted',
        errorMsg: 'Failed to delete ticket',
        extraInvalidateKeys: [qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Upsert Claim / Incident ─────────────────────────────────────────────────
export function useUpsertClaim() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id?: string; data: any }>(
      {
        mutationFn: async ({ id, data }) => {
          const url = id ? `/api/admin/claims/${id}` : '/api/admin/claims'
          const method = id ? 'PUT' : 'POST'
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Failed to save incident')
          return res.json()
        },
        queryKey: qk.hr.claims,
        successMsg: 'Incident saved',
        errorMsg: 'Failed to save incident',
        extraInvalidateKeys: [qk.hr.claimsKpi, qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Delete Claim / Incident ─────────────────────────────────────────────────
export function useDeleteClaim() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string }>(
      {
        mutationFn: async ({ id }) => {
          const res = await fetch(`/api/admin/claims/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete incident')
          return res.json()
        },
        queryKey: qk.hr.claims,
        successMsg: 'Incident deleted',
        errorMsg: 'Failed to delete incident',
        extraInvalidateKeys: [qk.hr.claimsKpi, qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Upsert Interview ────────────────────────────────────────────────────────
export function useUpsertInterview() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id?: string; data: any }>(
      {
        mutationFn: async ({ id, data }) => {
          const url = id ? `/api/admin/interviews/${id}` : '/api/admin/interviews'
          const method = id ? 'PUT' : 'POST'
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Failed to save interview')
          return res.json()
        },
        queryKey: qk.hr.interviews,
        updater: (old: any, { id, data }) => {
          if (!Array.isArray(old)) return old
          if (id) return old.map((t: any) => (t._id === id ? { ...t, ...data } : t))
          return [{ _id: `temp-${Date.now()}`, ...data }, ...old]
        },
        successMsg: 'Interview saved',
        errorMsg: 'Failed to save interview',
        extraInvalidateKeys: [qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Delete Interview ────────────────────────────────────────────────────────
export function useDeleteInterview() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string }>(
      {
        mutationFn: async ({ id }) => {
          const res = await fetch(`/api/admin/interviews/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete interview')
          return res.json()
        },
        queryKey: qk.hr.interviews,
        updater: (old: any, { id }) => {
          if (!Array.isArray(old)) return old
          return old.filter((t: any) => t._id !== id)
        },
        successMsg: 'Interview deleted',
        errorMsg: 'Failed to delete interview',
        extraInvalidateKeys: [qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Upsert Reimbursement ────────────────────────────────────────────────────
export function useUpsertReimbursement() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id?: string; data: any }>(
      {
        mutationFn: async ({ id, data }) => {
          const url = id ? `/api/admin/reimbursements/${id}` : '/api/admin/reimbursements'
          const method = id ? 'PUT' : 'POST'
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Failed to save reimbursement')
          return res.json()
        },
        queryKey: qk.hr.reimbursements,
        successMsg: 'Reimbursement saved',
        errorMsg: 'Failed to save reimbursement',
        extraInvalidateKeys: [qk.hr.reimbursementsKpi, qk.hr.dashboard],
      },
      qc,
    ),
  )
}

// ── Delete Reimbursement ────────────────────────────────────────────────────
export function useDeleteReimbursement() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { id: string }>(
      {
        mutationFn: async ({ id }) => {
          const res = await fetch(`/api/admin/reimbursements/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete reimbursement')
          return res.json()
        },
        queryKey: qk.hr.reimbursements,
        successMsg: 'Reimbursement deleted',
        errorMsg: 'Failed to delete reimbursement',
        extraInvalidateKeys: [qk.hr.reimbursementsKpi, qk.hr.dashboard],
      },
      qc,
    ),
  )
}
