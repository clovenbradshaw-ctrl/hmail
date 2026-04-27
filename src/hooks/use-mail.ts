import { create } from "zustand";

type Folder = "inbox" | "starred" | "archive" | "media";

export type SortKey =
  | "date-desc"
  | "date-asc"
  | "sender"
  | "subject"
  | "unread-first";

interface MailState {
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  folder: Folder;
  setFolder: (f: Folder) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  manageRoomsOpen: boolean;
  setManageRoomsOpen: (open: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;

  // Sort + filter
  sortBy: SortKey;
  setSortBy: (s: SortKey) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** When set, only conversations carrying this `u.`-namespaced tag are shown. */
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  /** Filter to conversations that have at least one attachment. */
  attachmentsOnly: boolean;
  setAttachmentsOnly: (v: boolean) => void;
  /** Filter to unread conversations. Replaces the local-only state in MailList. */
  unreadOnly: boolean;
  setUnreadOnly: (v: boolean) => void;

  /** When non-null, the main pane shows the long chain of messages from this MXID. */
  personViewMxid: string | null;
  setPersonViewMxid: (mxid: string | null) => void;

  /**
   * Room IDs the user has bulk-selected in the mail list. Drives the
   * inline action bar (Archive, Merge, …). Cleared on folder switch and
   * when a single conversation is opened.
   */
  selectedRoomIds: string[];
  toggleRoomSelected: (id: string) => void;
  setRoomsSelected: (ids: string[]) => void;
  clearRoomSelection: () => void;

  /** When set, the merge confirmation modal is rendered. */
  mergeModalOpen: boolean;
  setMergeModalOpen: (open: boolean) => void;
}

export const useMailStore = create<MailState>((set) => ({
  selectedRoomId: null,
  setSelectedRoomId: (id) =>
    set({ selectedRoomId: id, personViewMxid: null, selectedRoomIds: [] }),
  folder: "inbox",
  setFolder: (folder) =>
    set({
      folder,
      selectedRoomId: null,
      personViewMxid: null,
      activeTag: null,
      selectedRoomIds: [],
    }),
  composeOpen: false,
  setComposeOpen: (composeOpen) => set({ composeOpen }),
  manageRoomsOpen: false,
  setManageRoomsOpen: (manageRoomsOpen) => set({ manageRoomsOpen }),
  profileOpen: false,
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  sortBy: "date-desc",
  setSortBy: (sortBy) => set({ sortBy }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  activeTag: null,
  setActiveTag: (activeTag) =>
    set({ activeTag, selectedRoomId: null, personViewMxid: null }),
  attachmentsOnly: false,
  setAttachmentsOnly: (attachmentsOnly) => set({ attachmentsOnly }),
  unreadOnly: false,
  setUnreadOnly: (unreadOnly) => set({ unreadOnly }),

  personViewMxid: null,
  setPersonViewMxid: (personViewMxid) =>
    set({ personViewMxid, selectedRoomId: null }),

  selectedRoomIds: [],
  toggleRoomSelected: (id) =>
    set((s) => ({
      selectedRoomIds: s.selectedRoomIds.includes(id)
        ? s.selectedRoomIds.filter((x) => x !== id)
        : [...s.selectedRoomIds, id],
    })),
  setRoomsSelected: (ids) => set({ selectedRoomIds: ids }),
  clearRoomSelection: () => set({ selectedRoomIds: [] }),

  mergeModalOpen: false,
  setMergeModalOpen: (mergeModalOpen) => set({ mergeModalOpen }),
}));
