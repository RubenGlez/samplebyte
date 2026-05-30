import { useState } from 'react'
import { type Region } from 'wavesurfer.js/dist/plugins/regions'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import Sample from './Sample'

interface SampleListProps {
  samples?: Region[]
  selectedSample?: Region
  regionNames?: Record<string, string>
  onClick: (region: Region) => void
  onPlay?: (region: Region) => void
  onNameChange?: (regionId: string, name: string) => void
  onClearAll?: () => void
}

const SampleList = ({ samples = [], selectedSample, regionNames, onClick, onPlay, onNameChange, onClearAll }: SampleListProps) => {
  const [showClearDialog, setShowClearDialog] = useState(false)

  const handleConfirmClearAll = () => {
    onClearAll?.()
    setShowClearDialog(false)
  }
  if (!samples.length) return null

  return (
    <div className="px-4 pb-2">
      <div className="sticky top-0 z-10 flex justify-between items-center px-1 py-2 gap-2 bg-base/95 backdrop-blur border-b border-border/60">
        <span className="text-[11px] font-semibold text-faint tracking-wide select-none">
          Regions
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-faint/60 font-mono select-none">
            {samples.length} {samples.length === 1 ? 'chop' : 'chops'}
          </span>
          {onClearAll && (
            <Button variant="danger" size="sm" onClick={() => setShowClearDialog(true)}>
              Clear all
            </Button>
          )}
        </div>
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
            onPlay={onPlay}
            onNameChange={onNameChange}
          />
        ))}
      </ul>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogTitle>Clear all regions?</DialogTitle>
          <p className="text-[13px] text-muted m-0 leading-relaxed">
            This will remove all chops from the current waveform.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={handleConfirmClearAll}>
              Clear all
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SampleList
