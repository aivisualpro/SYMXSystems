import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '../keys'
import { makeOptimisticMutation } from '../optimistic'

// ── Fleet Dashboard ──────────────────────────────────────────────────────────
export function useFleetDashboard() {
  return useQuery({
    queryKey: qk.fleet.dashboard,
    queryFn: async () => {
      const res = await fetch('/api/fleet?section=dashboard')
      if (!res.ok) throw new Error('Failed to fetch fleet dashboard')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })
}

// ── Fleet Vehicles ───────────────────────────────────────────────────────────
export function useFleetVehicles() {
  return useQuery({
    queryKey: qk.fleet.vehicles,
    queryFn: async () => {
      const res = await fetch('/api/fleet?section=vehicles')
      if (!res.ok) throw new Error('Failed to fetch vehicles')
      const data = await res.json()
      return data?.vehicles ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ── Fleet Repairs (initial page) ─────────────────────────────────────────────
export function useFleetRepairs() {
  return useQuery({
    queryKey: qk.fleet.repairs,
    queryFn: async () => {
      const res = await fetch('/api/fleet?section=repairs&skip=0&limit=50&excludeCompleted=true')
      if (!res.ok) throw new Error('Failed to fetch repairs')
      const raw = await res.json()
      return {
        data: raw?.repairs ?? [],
        total: raw?.total ?? 0,
        hasMore: raw?.hasMore ?? false,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── Fleet Inspections (initial page) ─────────────────────────────────────────
export function useFleetInspections() {
  return useQuery({
    queryKey: qk.fleet.inspections,
    queryFn: async () => {
      const res = await fetch('/api/fleet?section=inspections&skip=0&limit=50')
      if (!res.ok) throw new Error('Failed to fetch inspections')
      const raw = await res.json()
      return {
        data: raw?.inspections ?? [],
        total: raw?.total ?? 0,
        hasMore: raw?.hasMore ?? false,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── Fleet Rentals ────────────────────────────────────────────────────────────
export function useFleetRentals() {
  return useQuery({
    queryKey: qk.fleet.rentals,
    queryFn: async () => {
      const res = await fetch('/api/fleet?section=rentals')
      if (!res.ok) throw new Error('Failed to fetch rentals')
      const raw = await res.json()
      return raw?.rentals ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  FLEET MUTATION HOOKS
// ══════════════════════════════════════════════════════════════════════════════

// ── Generic Fleet Upsert (vehicles, repairs, inspections, rentals) ───────────
export function useFleetUpsert() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { type: string; id?: string; data: any }>(
      {
        mutationFn: async ({ type, id, data }) => {
          const method = id ? 'PUT' : 'POST'
          const body = id
            ? { type, id, data }
            : { type, data }
          const res = await fetch('/api/fleet', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`Failed to save ${type}`)
          return res.json()
        },
        queryKey: [
          qk.fleet.vehicles,
          qk.fleet.repairs,
          qk.fleet.inspections,
          qk.fleet.rentals,
        ],
        successMsg: 'Saved successfully',
        errorMsg: 'Failed to save — try again',
        extraInvalidateKeys: [qk.fleet.dashboard],
      },
      qc,
    ),
  )
}

// ── Fleet Delete ─────────────────────────────────────────────────────────────
export function useFleetDelete() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { type: string; id: string }>(
      {
        mutationFn: async ({ type, id }) => {
          const res = await fetch('/api/fleet', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id }),
          })
          if (!res.ok) throw new Error(`Failed to delete ${type}`)
          return res.json()
        },
        queryKey: [
          qk.fleet.vehicles,
          qk.fleet.repairs,
          qk.fleet.inspections,
          qk.fleet.rentals,
        ],
        successMsg: 'Deleted successfully',
        errorMsg: 'Failed to delete — try again',
        extraInvalidateKeys: [qk.fleet.dashboard],
      },
      qc,
    ),
  )
}

// ── Fleet Inline Status Update (repairs) ─────────────────────────────────────
export function useFleetUpdateStatus() {
  const qc = useQueryClient()
  return useMutation(
    makeOptimisticMutation<any, { type: string; id: string; data: any }>(
      {
        mutationFn: async ({ type, id, data }) => {
          const res = await fetch('/api/fleet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id, data }),
          })
          if (!res.ok) throw new Error('Failed to update status')
          return res.json()
        },
        queryKey: qk.fleet.repairs,
        successMsg: undefined, // silent — inline change is the feedback
        errorMsg: 'Failed to update status',
        extraInvalidateKeys: [qk.fleet.dashboard],
      },
      qc,
    ),
  )
}
