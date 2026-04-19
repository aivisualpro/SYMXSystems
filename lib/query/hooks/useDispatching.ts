import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../keys";

export function useDispatchingRoutes(yearWeek: string, date?: string) {
  return useQuery({
    queryKey: date ? ["dispatching", "routes", yearWeek, date] : ["dispatching", "routes", yearWeek],
    queryFn: async () => {
      const url = date 
        ? `/api/dispatching/routes?yearWeek=${encodeURIComponent(yearWeek)}&date=${encodeURIComponent(date)}`
        : `/api/dispatching/routes?yearWeek=${encodeURIComponent(yearWeek)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch dispatching routes");
      return res.json();
    },
    staleTime: 2_000,
    enabled: !!yearWeek,
  });
}

export function useUpdateRouteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload }: { payload: any }) => {
      const res = await fetch("/api/dispatching/confirmation-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      return data;
    },
    onMutate: async ({ payload }) => {
      const { yearWeek, scheduleDate, transporterId, status, changeRemarks } = payload;
      
      // Cancel any outgoing queries
      await queryClient.cancelQueries({ queryKey: qk.dispatching.routes(yearWeek) });
      
      // Snapshot previous state
      const previousRoutes = queryClient.getQueryData(qk.dispatching.routes(yearWeek));
      
      // Optimistically update status 
      if (previousRoutes && yearWeek) {
        queryClient.setQueryData(qk.dispatching.routes(yearWeek), (old: any) => {
          if (!old || !old.confirmations) return old;
          
          const key = `${transporterId}_${scheduleDate}`;
          const updatedConfirmations = { ...old.confirmations };
          
          updatedConfirmations[key] = {
             ...(updatedConfirmations[key] || {}),
             status,
             changeRemarks,
             updatedAt: new Date().toISOString()
          };
          
          return {
            ...old,
            confirmations: updatedConfirmations
          };
        });
      }
      
      return { previousRoutes, yearWeek };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousRoutes && context?.yearWeek) {
         queryClient.setQueryData(qk.dispatching.routes(context.yearWeek), context.previousRoutes);
      }
    },
    onSettled: (data, error, variables, context: any) => {
      const yw = variables.payload?.yearWeek || context?.yearWeek;
      if (yw) {
         queryClient.invalidateQueries({ queryKey: qk.dispatching.routes(yw) });
         queryClient.invalidateQueries({ queryKey: qk.schedules.week(yw) });
      } else {
         queryClient.invalidateQueries({ queryKey: ["dispatching"] });
         queryClient.invalidateQueries({ queryKey: ["schedules"] });
      }
    }
  });
}
