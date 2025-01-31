import Editor from "./components/Editor";
import Loader from "./components/Loader";
import Layout from "./components/Layout";
import { useDownload } from "./hooks/useDownload";
import { useFileManagement } from "./hooks/useFileManagement";

export default function App() {
  const { audio, handleFileLoaded, handleDownload, isLoading } = useDownload();
  const { retrieveProject, project, storedProjects, fetchStoredProjects } =
    useFileManagement();

  const handleProjectLoad = (projectName: string) => {
    retrieveProject(projectName);
  };

  return (
    <Layout>
      {project ? (
        <Editor
          name={project.name}
          size={project.song.byteLength}
          type="audio/mp3"
          path={URL.createObjectURL(
            new Blob([project.song], { type: "audio/mp3" })
          )}
        />
      ) : audio.path ? (
        <Editor
          name={audio.name}
          size={audio.size}
          type={audio.type}
          path={audio.path}
        />
      ) : (
        <Loader
          onFileLoaded={handleFileLoaded}
          onUrlLoaded={handleDownload}
          isLoading={isLoading}
          onProjectLoad={handleProjectLoad}
          storedProjects={storedProjects}
          fetchStoredProjects={fetchStoredProjects}
        />
      )}
    </Layout>
  );
}
