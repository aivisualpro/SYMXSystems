import { useQuery } from '@tanstack/react-query'
import { qk } from '../keys'

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
