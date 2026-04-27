import { useQuery } from '@tanstack/react-query'
import { qk } from '../keys'

export function useDropdowns() {
  return useQuery({
    queryKey: qk.admin.dropdowns,
    queryFn: async () => {
      const res = await fetch('/api/admin/settings/dropdowns')
      if (!res.ok) throw new Error('Failed to fetch dropdowns')
      return res.json()
    },
    staleTime: Infinity,
  })
}

export function useVehicles() {
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

export function useWst() {
  return useQuery({
    queryKey: qk.admin.wst,
    queryFn: async () => {
      const res = await fetch('/api/admin/settings/wst')
      if (!res.ok) throw new Error('Failed to fetch WST')
      return res.json()
    },
    staleTime: Infinity,
  })
}

export function useRouteTypes() {
  return useQuery({
    queryKey: ['admin', 'routeTypes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings/route-types')
      if (!res.ok) throw new Error('Failed to fetch route types')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })
}

