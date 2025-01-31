import { useEffect } from "react";

interface ProjectDialogProps {
  projects: string[];
  onSelect: (projectName: string) => void;
  onClose: () => void;
}

export default function ProjectDialog({
  projects,
  onSelect,
  onClose,
}: ProjectDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-4 rounded shadow-lg">
        <h2 className="text-lg font-bold mb-4">Select a Project</h2>
        <ul className="list-none p-0 m-0">
          {projects.map((project) => (
            <li key={project} className="mb-2">
              <button
                className="w-full text-left p-2 bg-gray-200 hover:bg-gray-300 rounded"
                onClick={() => onSelect(project)}
              >
                {project}
              </button>
            </li>
          ))}
        </ul>
        <button
          className="mt-4 p-2 bg-red-500 text-white rounded"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
