import { useQuery } from '@tanstack/react-query'
import { qk } from '../keys'

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
