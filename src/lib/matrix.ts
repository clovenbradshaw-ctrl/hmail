import * as sdk from "matrix-js-sdk";
import type { MatrixClient, ICreateClientOpts } from "matrix-js-sdk";
import {
  ClientEvent,
  RoomEvent,
  RoomStateEvent,
  MatrixEventEvent,
} from "matrix-js-sdk";
import {
  CryptoEvent,
  VerificationPhase,
  VerificationRequestEvent,
  VerifierEvent,
  type GeneratedSecretStorageKey,
  type ShowSasCallbacks,
  type VerificationRequest,
  type Verifier,
} from "matrix-js-sdk/lib/crypto-api";

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

let _pendingVerification: VerificationRequest | null = null;
let _activeVerifier: Verifier | null = null;
let _activeSas: ShowSasCallbacks | null = null;
let _secretStorageReady: boolean | null = null;

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
    if (state === "PREPARED") {
      _syncState = "prepared";
      // Fire-and-forget; updates `_secretStorageReady` and notifies on change.
      void refreshSecretStorageStatus();
    } else if (state === "SYNCING") _syncState = "syncing";
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

  // matrix-js-sdk types CryptoEvent on the client emitter via a separate
  // augmentation; cast through `unknown` rather than fighting the surface.
  const cryptoOn = (
    client as unknown as {
      on: (ev: CryptoEvent, cb: (...args: unknown[]) => void) => void;
    }
  ).on.bind(client);

  cryptoOn(CryptoEvent.VerificationRequestReceived, (req) => {
    attachVerificationRequest(req as VerificationRequest);
  });
}

function attachVerificationRequest(req: VerificationRequest) {
  // Replace any prior request with the freshest one. Older requests will
  // fall out of scope when their phase advances to Cancelled / Done.
  _pendingVerification = req;
  _activeVerifier = null;
  _activeSas = null;
  notify();

  const handleChange = () => {
    if (req.phase === VerificationPhase.Started && req.verifier && req.verifier !== _activeVerifier) {
      attachVerifier(req.verifier);
    }
    if (
      req.phase === VerificationPhase.Cancelled ||
      req.phase === VerificationPhase.Done
    ) {
      if (_pendingVerification === req) {
        _pendingVerification = null;
        _activeVerifier = null;
        _activeSas = null;
      }
    }
    notify();
  };
  req.on(VerificationRequestEvent.Change, handleChange);
}

function attachVerifier(verifier: Verifier) {
  _activeVerifier = verifier;
  _activeSas = verifier.getShowSasCallbacks();
  notify();

  verifier.on(VerifierEvent.ShowSas, (sas) => {
    _activeSas = sas;
    notify();
  });
  verifier.on(VerifierEvent.Cancel, () => {
    if (_activeVerifier === verifier) {
      _activeVerifier = null;
      _activeSas = null;
    }
    notify();
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
  _pendingVerification = null;
  _activeVerifier = null;
  _activeSas = null;
  _secretStorageReady = null;
  notify();
  // Wipe IndexedDB stores so a fresh login starts clean.
  try {
    indexedDB.deleteDatabase(`${STORE_PREFIX}sync`);
    indexedDB.deleteDatabase(CRYPTO_STORE_NAME);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Verification (SAS) — incoming-request surface
// ---------------------------------------------------------------------------

export function getPendingVerification(): VerificationRequest | null {
  return _pendingVerification;
}

export function getActiveSas(): ShowSasCallbacks | null {
  return _activeSas;
}

export function getActiveVerifier(): Verifier | null {
  return _activeVerifier;
}

export async function acceptPendingVerification(): Promise<void> {
  const req = _pendingVerification;
  if (!req) return;
  await req.accept();
  // Once both sides are Ready, kick off SAS as our preferred method.
  // The remote side may have started us — if so, the verifier is already there.
  if (!req.verifier && req.phase === VerificationPhase.Ready) {
    try {
      const verifier = await req.startVerification("m.sas.v1");
      attachVerifier(verifier);
      // Begin the verification — resolves once both sides have exchanged
      // m.key.verification.mac. We don't await here; the modal drives it.
      void verifier.verify().catch(() => {
        /* errors surface via VerifierEvent.Cancel */
      });
    } catch {
      /* if start fails, the user can cancel and retry */
    }
  }
}

export async function cancelPendingVerification(): Promise<void> {
  const req = _pendingVerification;
  if (!req) return;
  try {
    await req.cancel({ reason: "User declined" });
  } catch {
    /* ignore */
  }
  _pendingVerification = null;
  _activeVerifier = null;
  _activeSas = null;
  notify();
}

export async function confirmSas(): Promise<void> {
  const sas = _activeSas;
  if (!sas) return;
  try {
    await sas.confirm();
  } catch {
    /* ignore — Cancel event will clean up state */
  }
}

export function reportSasMismatch(): void {
  _activeSas?.mismatch();
}

// ---------------------------------------------------------------------------
// Secret storage / key backup bootstrap
// ---------------------------------------------------------------------------

export function getSecretStorageReady(): boolean | null {
  return _secretStorageReady;
}

/**
 * Refresh the cached `isSecretStorageReady()` value. Called after sync prepared
 * and after a successful bootstrap.
 */
export async function refreshSecretStorageStatus(): Promise<boolean | null> {
  const client = _client;
  if (!client) {
    _secretStorageReady = null;
    return null;
  }
  const crypto = client.getCrypto();
  if (!crypto) return _secretStorageReady;
  try {
    const ready = await crypto.isSecretStorageReady();
    if (ready !== _secretStorageReady) {
      _secretStorageReady = ready;
      notify();
    }
    return ready;
  } catch {
    return _secretStorageReady;
  }
}

/**
 * Set up cross-signing + secret storage + a new key backup, returning the
 * generated recovery key (encoded for display).
 *
 * `password` is the user's account password — required for the UIA challenge
 * on `authUploadDeviceSigningKeys`. Most homeservers gate cross-signing
 * publication behind it.
 */
export async function setupSecretStorage(password: string): Promise<string> {
  const client = _client;
  if (!client) throw new Error("Not signed in.");
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("Crypto not initialised.");
  const userId = client.getUserId();
  if (!userId) throw new Error("No user id on client.");

  // 1. Generate a recovery key. We hold onto it locally so bootstrap can
  //    return it via createSecretStorageKey, and so we can show it to the
  //    user afterwards.
  const recoveryKey: GeneratedSecretStorageKey =
    await crypto.createRecoveryKeyFromPassphrase();

  // 2. Cross-signing first, with UIA backed by the password we collected.
  await crypto.bootstrapCrossSigning({
    authUploadDeviceSigningKeys: async (makeRequest) => {
      await makeRequest({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: userId },
        password,
      });
    },
  });

  // 3. Secret storage + a fresh key backup.
  await crypto.bootstrapSecretStorage({
    createSecretStorageKey: async () => recoveryKey,
    setupNewKeyBackup: true,
  });

  await refreshSecretStorageStatus();

  if (!recoveryKey.encodedPrivateKey) {
    throw new Error(
      "Recovery key was generated but no encoded form is available.",
    );
  }
  return recoveryKey.encodedPrivateKey;
}
