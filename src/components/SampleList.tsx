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
    <div className="px-5 pb-1">
      <div className="flex justify-between items-center px-2 py-1.5">
        <span className="text-[10px] font-medium tracking-widest uppercase text-faint" style={{ fontFamily: 'var(--font-family-brand)' }}>
          Regions
        </span>
        <span className="text-[10px] text-faint" style={{ fontFamily: 'var(--font-family-mono)' }}>
          {samples.length} chop{samples.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="list-none flex flex-col m-0 p-0 max-h-44 overflow-y-auto">
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
