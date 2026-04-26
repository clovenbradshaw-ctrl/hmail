import * as sdk from "matrix-js-sdk";
import type { MatrixClient, ICreateClientOpts } from "matrix-js-sdk";
import {
  ClientEvent,
  RoomEvent,
  RoomStateEvent,
  MatrixEventEvent,
} from "matrix-js-sdk";

// Stage 4 wires SAS UI; we just listen so cross-signing isn't dropped silently.
const VERIFICATION_REQUEST_EVENT = "crypto.verificationRequestReceived" as const;

const SESSION_KEY = "hmail:session";
const STORE_PREFIX = "hmail:matrix:";
const CRYPTO_STORE_NAME = "hmail-crypto";

export interface PersistedSession {
  access_token: string;
  user_id: string;
  device_id: string;
  home_server: string;
}

let _client: MatrixClient | null = null;
type SyncPhase = "logged_out" | "starting" | "prepared" | "syncing" | "error";
let _syncState: SyncPhase = "logged_out";
const _listeners = new Set<() => void>();

function notify() {
  for (const fn of _listeners) fn();
}

export function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export function getClient(): MatrixClient | null {
  return _client;
}

export function getSyncPhase(): SyncPhase {
  return _syncState;
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Resolve a homeserver URL from an MXID like @alice:matrix.org via
 * .well-known/matrix/client. Falls back to https://<domain>.
 */
export async function resolveHomeserver(mxidOrDomain: string): Promise<string> {
  const domain = mxidOrDomain.includes(":")
    ? mxidOrDomain.split(":").slice(1).join(":")
    : mxidOrDomain;
  const wellKnownUrl = `https://${domain}/.well-known/matrix/client`;
  try {
    const res = await fetch(wellKnownUrl, { method: "GET" });
    if (res.ok) {
      const body = await res.json();
      const base = body?.["m.homeserver"]?.base_url;
      if (typeof base === "string" && base.length > 0) {
        return base.replace(/\/$/, "");
      }
    }
  } catch {
    /* fall through */
  }
  return `https://${domain}`;
}

function buildOpts(
  baseUrl: string,
  session?: PersistedSession,
): ICreateClientOpts {
  const opts: ICreateClientOpts = {
    baseUrl,
    timelineSupport: true,
  };
  if (session) {
    opts.userId = session.user_id;
    opts.deviceId = session.device_id;
    opts.accessToken = session.access_token;
  }
  // IndexedDB-backed memory store for session data; the Rust crypto store
  // is initialized separately via initRustCrypto and uses its own IDB.
  if (typeof indexedDB !== "undefined") {
    const indexedDBStore = new sdk.IndexedDBStore({
      indexedDB,
      localStorage,
      dbName: `${STORE_PREFIX}sync`,
    });
    opts.store = indexedDBStore;
  }
  return opts;
}

function attachListeners(client: MatrixClient) {
  client.on(ClientEvent.Sync, (state) => {
    if (state === "PREPARED") _syncState = "prepared";
    else if (state === "SYNCING") _syncState = "syncing";
    else if (state === "ERROR") _syncState = "error";
    notify();
  });

  client.on(RoomEvent.Timeline, () => notify());
  client.on(RoomEvent.Redaction, () => notify());
  client.on(RoomEvent.Receipt, () => notify());
  client.on(RoomEvent.MyMembership, () => notify());
  client.on(RoomEvent.Tags, () => notify());
  client.on(RoomEvent.Name, () => notify());
  client.on(RoomStateEvent.Events, () => notify());
  client.on(ClientEvent.AccountData, () => notify());

  client.on(MatrixEventEvent.Decrypted, () => notify());

  // Verification handler — Stage 1 just logs; Stage 4 surfaces SAS UI.
  (client as unknown as {
    on: (ev: string, cb: (req: unknown) => void) => void;
  }).on(VERIFICATION_REQUEST_EVENT, (req) => {
    console.log("[hmail] verification request received", req);
  });
}

async function bootstrapClient(
  baseUrl: string,
  session?: PersistedSession,
): Promise<MatrixClient> {
  if (_client) return _client;
  const opts = buildOpts(baseUrl, session);
  const client = sdk.createClient(opts);

  if (opts.store) {
    await (opts.store as { startup: () => Promise<void> }).startup();
  }

  // Rust crypto, IndexedDB-backed. This is the single most important call
  // in the whole app — wrong store and decryption silently fails.
  if ("initRustCrypto" in client && typeof client.initRustCrypto === "function") {
    await client.initRustCrypto({
      useIndexedDB: true,
      cryptoDatabasePrefix: CRYPTO_STORE_NAME,
    });
  }

  attachListeners(client);

  _syncState = "starting";
  notify();

  await client.startClient({
    initialSyncLimit: 10,
    lazyLoadMembers: true,
  });

  _client = client;
  return client;
}

export async function loginWithPassword(
  homeserverUrl: string,
  user: string,
  password: string,
): Promise<MatrixClient> {
  // Use a transient client just for the login call.
  const stub = sdk.createClient({ baseUrl: homeserverUrl });
  const identifier =
    user.startsWith("@")
      ? { type: "m.id.user", user: user.slice(1).split(":")[0] }
      : { type: "m.id.user", user };
  const res = await stub.loginRequest({
    type: "m.login.password",
    identifier,
    password,
    initial_device_display_name: "hmail (web)",
  });
  const session: PersistedSession = {
    access_token: res.access_token,
    user_id: res.user_id,
    device_id: res.device_id,
    home_server: homeserverUrl,
  };
  saveSession(session);
  return bootstrapClient(homeserverUrl, session);
}

export async function hydrateFromSession(): Promise<MatrixClient | null> {
  const session = loadSession();
  if (!session) return null;
  return bootstrapClient(session.home_server, session);
}

export async function logout() {
  if (_client) {
    try {
      await _client.logout(true);
    } catch {
      /* swallow — we still want to clear local state */
    }
    _client.stopClient();
    _client = null;
  }
  clearSession();
  _syncState = "logged_out";
  notify();
  // Wipe IndexedDB stores so a fresh login starts clean.
  try {
    indexedDB.deleteDatabase(`${STORE_PREFIX}sync`);
    indexedDB.deleteDatabase(CRYPTO_STORE_NAME);
  } catch {
    /* ignore */
  }
}
