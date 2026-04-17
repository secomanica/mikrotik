import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rosService } from '../services/routerosService';

export function useRouterOS(deviceId: number, rosPath: string, pollInterval?: number) {
  const queryClient = useQueryClient();
  const queryKey = ['ros', deviceId, rosPath];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await rosService.get(deviceId, rosPath);
      if (!result.success) throw new Error(result.error || 'Erro ao consultar RouterOS');
      return result.data;
    },
    refetchInterval: pollInterval,
    enabled: !!deviceId && !!rosPath,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => rosService.create(deviceId, rosPath, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      rosService.update(deviceId, rosPath, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => rosService.remove(deviceId, rosPath, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const commandMutation = useMutation({
    mutationFn: ({ path, data }: { path: string; data?: Record<string, any> }) =>
      rosService.command(deviceId, path, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    command: commandMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
