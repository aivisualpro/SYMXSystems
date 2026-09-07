import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../keys";

// Fetch list
export function useEmployeesList(filters?: Record<string, any>) {
  return useQuery({
    queryKey: qk.employees.list(filters),
    queryFn: async () => {
      const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
      const res = await fetch(`/api/admin/employees${qs}`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

// Fetch details
export function useEmployeeDetail(id: string) {
  return useQuery({
    queryKey: qk.employees.detail(id),
    queryFn: async () => {
      if (!id) throw new Error("Missing ID");
      const res = await fetch(`/api/admin/employees/${id}`);
      if (!res.ok) throw new Error("Failed to fetch employee");
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!id,
  });
}

// Mutate detail
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to update employee");
      return res.json();
    },
    onSuccess: (updatedEmployee, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.employees.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: qk.hr.dashboard });
      // Schedules might have the employee references
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

// Manually re-run schedule sync for one employee — for the case where a
// station transfer happened before the destination station had generated
// its weeks, so the automatic sync-on-save skipped and nothing since has
// re-triggered it.
export function useResyncEmployeeSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/employees/${id}/resync-schedule`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to resync schedule");
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: qk.employees.detail(id) });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// Mutate create
export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to create employee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.employees.all });
      queryClient.invalidateQueries({ queryKey: qk.hr.dashboard });
    },
  });
}
