import type { ProjectChop, Sample } from '../../types'

// Whether a materialized chop-sample has drifted from its source chop: the chop was edited after the
// sample was last built. refreshChopSample bumps the sample's created_at on every rebuild, so this
// inequality is the single drift signal the library sync uses to decide a re-trim. The planned
// pack-recovery UX (drift of pads referencing a chop) plugs in here too.
export function isChopSampleStale(
  chop: Pick<ProjectChop, 'updatedAt'>,
  sample: Pick<Sample, 'createdAt'>
): boolean {
  return chop.updatedAt > sample.createdAt
}
