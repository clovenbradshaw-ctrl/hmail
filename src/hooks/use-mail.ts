import { create } from "zustand";
import { MOCK_CONVERSATIONS } from "@/lib/mock-data";

interface MailState {
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
}

export const useMailStore = create<MailState>((set) => ({
  selectedRoomId: MOCK_CONVERSATIONS[0]?.room_id ?? null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
}));
