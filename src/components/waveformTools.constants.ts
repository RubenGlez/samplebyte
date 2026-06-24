export type WaveformTool = 'loop' | 'chop' | 'trim'

export const LOOP_BAR_OPTIONS = ['1', '2', '4', '8', '16'] as const
export type LoopBarCount = (typeof LOOP_BAR_OPTIONS)[number]

export const SLICE_OPTIONS = ['4', '8', '16', '32'] as const
export type SliceCount = (typeof SLICE_OPTIONS)[number]

export type ChopMethod = 'hits' | 'slices'
export type HitSensitivity = 'coarse' | 'medium' | 'fine'

export const SENSITIVITY_LABELS: Record<HitSensitivity, string> = {
  coarse: 'Few',
  medium: 'Medium',
  fine: 'Many',
}
