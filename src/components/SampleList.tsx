import { type Region } from 'wavesurfer.js/dist/plugins/regions'
import Sample from './Sample'

interface SampleListProps {
  samples?: Region[]
  selectedSample?: Region
  onClick: (region: Region) => void
  onNameChange?: (regionId: string, name: string) => void
}

const SampleList = ({ samples = [], selectedSample, onClick, onNameChange }: SampleListProps) => {
  if (!samples.length) return null

  return (
    <div className="px-6 pb-2">
      <div className="px-3 py-1 flex justify-between">
        <span className="text-xs text-white/30">Name</span>
        <span className="text-xs text-white/30">Duration</span>
      </div>
      <ul className="list-none flex flex-col m-0 p-0 max-h-48 overflow-y-auto">
        {samples.map((sample, index) => (
          <Sample
            key={sample.id}
            sample={sample}
            isSelected={sample.id === selectedSample?.id}
            index={index}
            onClick={onClick}
            onNameChange={onNameChange}
          />
        ))}
      </ul>
    </div>
  )
}

export default SampleList
