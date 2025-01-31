import Button from "./Button";

type ActionProps = {
  handleExport: () => void;
  handleSave: () => void;
};

export default function Actions({ handleExport, handleSave }: ActionProps) {
  return (
    <div className="p-8 pt-0 flex gap-8 justify-end">
      <Button onClick={handleExport}>{"EXPORT"}</Button>
      <Button onClick={handleSave}>{"SAVE"}</Button>
    </div>
  );
}
