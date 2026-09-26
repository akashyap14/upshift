// React Query hooks over api/client.ts. Mutations invalidate the queries they change.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { GenerateRequest, ReviewQuestion, RewardInput } from './types'

export const keys = {
  users: ['users'] as const,
  documents: ['documents'] as const,
  packs: ['packs'] as const,
  pack: (id: number) => ['packs', id] as const,
  rewards: (userId: number) => ['rewards', userId] as const,
  catalogue: ['rewards'] as const,
  redemptions: ['redemptions'] as const,
  dashboard: (companyId: number) => ['dashboard', companyId] as const,
}

// ---- Login ----
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.users })

// ---- Documents ----
export const useDocuments = () => useQuery({ queryKey: keys.documents, queryFn: api.documents })

export function useUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => api.upload(file, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.documents }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.documents })
      qc.invalidateQueries({ queryKey: keys.packs })
    },
  })
}

export function useGenerate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, body }: { docId: number; body: GenerateRequest }) => api.generate(docId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.documents })
      qc.invalidateQueries({ queryKey: keys.packs })
    },
  })
}

// ---- Packs ----
export const usePacks = () => useQuery({ queryKey: keys.packs, queryFn: api.packs })
export const usePack = (id: number) => useQuery({ queryKey: keys.pack(id), queryFn: () => api.pack(id) })

function usePackMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.packs }),
  })
}

export const useApprove = () => usePackMutation(api.approve)
export const useDeletePack = () => usePackMutation(api.deletePack)
export const useEditQuestion = () =>
  usePackMutation(({ id, body }: { id: number; body: Partial<Omit<ReviewQuestion, 'id' | 'pack_id' | 'verified'>> }) =>
    api.editQuestion(id, body),
  )
export const useDeleteQuestion = () => usePackMutation(api.deleteQuestion)
export const useRegenerateQuestion = () => usePackMutation(api.regenerateQuestion)
export const useAssign = () => usePackMutation(api.assign)

// ---- Rewards ----
export const useRewards = (userId: number) => useQuery({ queryKey: keys.rewards(userId), queryFn: () => api.rewards(userId) })
export const useRedemptions = () => useQuery({ queryKey: keys.redemptions, queryFn: api.redemptions })

function useRewardMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.catalogue })
      qc.invalidateQueries({ queryKey: keys.redemptions })
    },
  })
}

export const useRedeem = () => useRewardMutation(({ rewardId, userId }: { rewardId: number; userId: number }) => api.redeem(rewardId, userId))
export const useCreateReward = () => useRewardMutation((body: RewardInput) => api.createReward(body))
export const useUpdateReward = () =>
  useRewardMutation(({ id, body }: { id: number; body: Partial<RewardInput> }) => api.updateReward(id, body))
export const useDeleteReward = () => useRewardMutation(api.deleteReward)

// ---- Dashboard ----
export const useDashboard = (companyId: number) =>
  useQuery({ queryKey: keys.dashboard(companyId), queryFn: () => api.dashboard(companyId), refetchInterval: 15_000 })
