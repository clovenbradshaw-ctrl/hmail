import { create } from "zustand";

type Folder = "inbox" | "starred" | "archive";

interface MailState {
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  folder: Folder;
  setFolder: (f: Folder) => void;
}

export const useMailStore = create<MailState>((set) => ({
  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
  folder: "inbox",
  setFolder: (folder) => set({ folder }),
}));
