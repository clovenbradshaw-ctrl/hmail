import { create } from "zustand";

type Folder = "inbox" | "starred" | "archive" | "media";

interface MailState {
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  folder: Folder;
  setFolder: (f: Folder) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  manageRoomsOpen: boolean;
  setManageRoomsOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

export const useMailStore = create<MailState>((set) => ({
  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
  folder: "inbox",
  setFolder: (folder) => set({ folder, selectedRoomId: null }),
  composeOpen: false,
  setComposeOpen: (composeOpen) => set({ composeOpen }),
  manageRoomsOpen: false,
  setManageRoomsOpen: (manageRoomsOpen) => set({ manageRoomsOpen }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
