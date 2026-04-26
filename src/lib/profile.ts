import { useSyncExternalStore } from "react";
import { getClient, subscribe } from "@/lib/matrix";

/**
 * The user's display name is the standard Matrix m.profile.display_name.
 * Setting it via setDisplayName makes the homeserver broadcast an
 * m.room.member event into every joined room — that's how it becomes
 * discoverable to the people we share rooms with, and how an updated name
 * propagates without us touching each room.
 */

function readDisplayNameFromRooms(): string {
  const client = getClient();
  if (!client) return "";
  const myUserId = client.getUserId();
  if (!myUserId) return "";
  for (const room of client.getRooms()) {
    const member = room.getMember(myUserId);
    if (member?.rawDisplayName) return member.rawDisplayName;
  }
  return "";
}

export async function getMyDisplayName(): Promise<string> {
  const cached = readDisplayNameFromRooms();
  if (cached) return cached;
  const client = getClient();
  if (!client) return "";
  const myUserId = client.getUserId();
  if (!myUserId) return "";
  try {
    const profile = (await client.getProfileInfo(myUserId, "displayname")) as {
      displayname?: string;
    };
    return profile.displayname ?? "";
  } catch {
    return "";
  }
}

export async function setMyDisplayName(name: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await client.setDisplayName(name);
}

/**
 * Reactive view of the current user's display name. Refreshes whenever the
 * homeserver echoes an m.room.member update back to us.
 */
export function useMyDisplayName(): string {
  return useSyncExternalStore(
    subscribe,
    readDisplayNameFromRooms,
    () => "",
  );
}
