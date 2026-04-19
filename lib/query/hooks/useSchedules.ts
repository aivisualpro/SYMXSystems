import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../keys";

export function useSchedulingWeeks() {
  return useQuery({
    queryKey: ['schedules', 'weeksList'],
    queryFn: async () => {
      const res = await fetch("/api/schedules?weeksList=true");
      if (!res.ok) throw new Error("Failed to fetch weeks list");
      const data = await res.json();
      return data?.weeks || [];
    },
    staleTime: 10 * 60_000,
  });
}

export function useWeekSchedules(yearWeek: string) {
  return useQuery({
    queryKey: qk.schedules.week(yearWeek),
    queryFn: async () => {
      const res = await fetch(`/api/schedules?yearWeek=${yearWeek}`);
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!yearWeek,
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload }: { payload: any }) => {
      // If we are creating/updating a schedule, it usually hits /api/schedules with PATCH or PUT
      const res = await fetch("/api/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onMutate: async ({ payload }) => {
      const { yearWeek, transporterId, dayIdx, type, status, startTime } = payload;
      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      if (yearWeek) {
        await queryClient.cancelQueries({ queryKey: qk.schedules.week(yearWeek) });
      }

      // Snapshot the previous value
      const previousSchedules = yearWeek ? queryClient.getQueryData(qk.schedules.week(yearWeek)) : null;

      // Optimistically update to the new value
      if (yearWeek && previousSchedules) {
        queryClient.setQueryData(qk.schedules.week(yearWeek), (old: any) => {
          if (!old || !old.employees) return old;
          return {
            ...old,
            employees: old.employees.map((emp: any) => {
              if (emp.transporterId !== transporterId) return emp;
              // Update the specific day idx. If dayIdx is passed, use it, else we can't easily guess.
              if (typeof dayIdx === 'number') {
                return {
                  ...emp,
                  days: {
                    ...emp.days,
                    [dayIdx]: {
                      ...(emp.days[dayIdx] || {}),
                      type: type !== undefined ? type : emp.days[dayIdx]?.type,
                      status: status !== undefined ? status : emp.days[dayIdx]?.status,
                      startTime: startTime !== undefined ? startTime : emp.days[dayIdx]?.startTime,
                    }
                  }
                };
              }
              return emp;
            })
          };
        });
      }

      // Return a context with the previous data
      return { previousSchedules, yearWeek };
    },
    onError: (err, variables, context: any) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSchedules && context?.yearWeek) {
        queryClient.setQueryData(qk.schedules.week(context.yearWeek), context.previousSchedules);
      }
    },
    onSettled: (data, error, variables, context: any) => {
      // Always refetch after error or success to ensure source of truth
      const yw = variables.payload?.yearWeek || (context as any)?.yearWeek;
      if (yw) {
        queryClient.invalidateQueries({ queryKey: qk.schedules.week(yw) });
        queryClient.invalidateQueries({ queryKey: qk.dispatching.routes(yw) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ["dispatching"] });
      }
      queryClient.invalidateQueries({ queryKey: qk.hr.dashboard });
    },
  });
}
