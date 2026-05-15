import { type Region } from 'wavesurfer.js/dist/plugins/regions'
import Sample from './Sample'

interface SampleListProps {
  samples?: Region[]
  selectedSample?: Region
  regionNames?: Record<string, string>
  onClick: (region: Region) => void
  onNameChange?: (regionId: string, name: string) => void
}

const SampleList = ({ samples = [], selectedSample, regionNames, onClick, onNameChange }: SampleListProps) => {
  if (!samples.length) return null

  return (
    <div className="px-4 pb-2">
      <div className="flex justify-between items-center px-1 py-2">
        <span className="text-[11px] font-semibold text-faint tracking-wide select-none">
          Regions
        </span>
        <span className="text-[11px] text-faint/60 font-mono select-none">
          {samples.length} {samples.length === 1 ? 'chop' : 'chops'}
        </span>
      </div>
      <ul className="list-none flex flex-col m-0 p-0">
        {samples.map((sample, index) => (
          <Sample
            key={sample.id}
            sample={sample}
            isSelected={sample.id === selectedSample?.id}
            index={index}
            initialName={regionNames?.[sample.id]}
            onClick={onClick}
            onNameChange={onNameChange}
          />
        ))}
      </ul>
    </div>
  )
}

export default SampleList
