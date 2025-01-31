import { Session, Project, SampleRegion } from "electron/main/audio";
import { useEffect, useState } from "react";

export function useFileManagement() {
  const [sessions, setSessions] = useState<Session[]>();
  const [project, setProject] = useState<Project>();
  const [storedProjects, setStoredProjects] = useState<string[]>([]);

  const saveProject = async ({
    name,
    song,
    regions,
  }: {
    name: string;
    song: ArrayBuffer;
    regions: SampleRegion[];
  }) => {
    const songArray = Array.from(new Uint8Array(song));
    window.api.send("saveProject", { name, song: songArray, regions });
  };

  const retrieveProject = (fileName: string) => {
    window.api.send("retrieveProject", fileName);
  };

  const getAllSessions = () => {
    window.api.send("getSessions");
  };

  const fetchStoredProjects = () => {
    window.api.send("getStoredProjects");
  };

  useEffect(() => {
    window.api.receive("saveProjectSuccess", () => {
      alert("Project saved successfully");
    });
    window.api.receive("saveProjectError", (errorMessage) => {
      console.error(`Something went wrong saving the project: ${errorMessage}`);
    });
    window.api.receive("retrieveProjectSuccess", (params) => {
      const { name, song, regions } = params as Project;
      setProject({ name, song, regions });
    });
    window.api.receive("retrieveProjectError", (errorMessage) => {
      console.error(
        `Something went wrong retrieving the project: ${errorMessage}`
      );
    });
    window.api.receive("getSessionsSuccess", (params) => {
      const { sessions } = params as { sessions: Session[] };
      setSessions(sessions);
    });
    window.api.receive("getSessionsError", (errorMessage) => {
      console.error(
        `Something went wrong retrieving sessions: ${errorMessage}`
      );
    });
    window.api.receive("getStoredProjectsSuccess", (...args: unknown[]) => {
      const projects = args[0] as string[];
      setStoredProjects(projects);
    });
    window.api.receive("getStoredProjectsError", (errorMessage) => {
      console.error(
        `Something went wrong fetching stored projects: ${errorMessage}`
      );
    });
  }, []);

  return {
    sessions,
    project,
    storedProjects,
    saveProject,
    retrieveProject,
    getAllSessions,
    fetchStoredProjects,
  };
}
