import Button from './Button'

type ActionProps = {
  handleExport: () => void
  handleSave: () => void
  isSaving?: boolean
  isExporting?: boolean
}

export default function Actions({ handleExport, handleSave, isSaving, isExporting }: ActionProps) {
  return (
    <div className="p-8 pt-0 flex gap-8 justify-end">
      <Button onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'EXPORTING...' : 'EXPORT'}
      </Button>
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'SAVING...' : 'SAVE'}
      </Button>
    </div>
  )
}
