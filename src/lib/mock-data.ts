/**
 * Mock data for Phase 0.
 *
 * Shaped to mirror the Matrix data model so Phase 1's swap to real
 * matrix-js-sdk calls is mechanical — same field names, same nesting,
 * same display-name resolution path. When this file goes away, the
 * Mail components shouldn't need to change.
 */

export interface MockSender {
  mxid: string;
  /** Their published primary_name from social.hyphae.identity. */
  display_name: string;
  /** Their published nicknames. We may prefer one of these. */
  nicknames?: string[];
  /** A two-letter monogram for avatar fallback. */
  monogram: string;
}

export interface MockMessage {
  event_id: string;
  sender: MockSender;
  body: string;
  /** ISO timestamp. */
  ts: string;
  /** Optional thread root event_id this is a reply to. */
  thread_root?: string;
}

export interface MockConversation {
  /** room_id in Matrix terms. */
  room_id: string;
  /** Room name = subject line in hmail's metaphor. */
  subject: string;
  /** Last message timestamp, used for sort. */
  last_activity_ts: string;
  /** Participants other than you. */
  participants: MockSender[];
  /** True if any unread events. */
  unread: boolean;
  starred?: boolean;
  archived?: boolean;
  /** Tags from your account data (m.tag). */
  tags?: string[];
  /** All messages in the room, ordered. */
  messages: MockMessage[];
}

const me: MockSender = {
  mxid: "@you:hyphae.intelechia.com",
  display_name: "you",
  monogram: "Y",
};

const hmailBot: MockSender = {
  mxid: "@hmail:hyphae.intelechia.com",
  display_name: "hmail",
  monogram: "h",
};

const alice: MockSender = {
  mxid: "@alice:matrix.org",
  display_name: "Alice Chen",
  nicknames: ["Ali"],
  monogram: "AC",
};

const research: MockSender = {
  mxid: "@research:hyphae.intelechia.com",
  display_name: "Research Group",
  monogram: "R",
};

const ntoa: MockSender = {
  mxid: "@ntoa:matrix.org",
  display_name: "Nashville Open Archives",
  monogram: "NA",
};

const editor: MockSender = {
  mxid: "@editor:richtext.email",
  display_name: "Rich Text Editorial",
  monogram: "RT",
};

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    room_id: "!welcome:hyphae.intelechia.com",
    subject: "Welcome to hmail",
    last_activity_ts: "2026-04-26T09:14:00Z",
    participants: [hmailBot],
    unread: true,
    starred: true,
    tags: ["meta"],
    messages: [
      {
        event_id: "$001",
        sender: hmailBot,
        ts: "2026-04-26T09:14:00Z",
        body:
          "This is hmail. It looks like email. It is, underneath, a Matrix client.\n\nEach conversation is a room. Each reply is a thread. Names are authored by the people they refer to — you cannot make up private nicknames for other people, but you can choose which of their published nicknames to see. Messages can be edited, retracted, and reacted to. Files are stored once and referenced, not duplicated to every recipient.\n\nThis is Phase 0. Nothing is wired to a real homeserver yet. The data you're looking at is mock data, but it's shaped like real Matrix data so the swap will be invisible.",
      },
    ],
  },
  {
    room_id: "!surveillance-research:hyphae.intelechia.com",
    subject: "FUSUS / LeoSight org chart — found something",
    last_activity_ts: "2026-04-26T03:42:00Z",
    participants: [alice],
    unread: true,
    tags: ["work", "surveillance"],
    messages: [
      {
        event_id: "$010",
        sender: alice,
        ts: "2026-04-25T19:11:00Z",
        body:
          "Pulled the LinkedIn snapshots you sent and ran them through the dedup script. Mark Wood's transition from FUSUS CRO to LeoSight founder is cleaner than I thought — there's a six-month gap where he's listed at neither, which is when the LeoSight LLC paperwork was being filed in Delaware.\n\nGoing to dig into the Delaware filings tomorrow. If the registered agent is the same, that's a tell.",
      },
      {
        event_id: "$011",
        sender: me,
        ts: "2026-04-25T20:02:00Z",
        body:
          "Nice. Six months matches what Metro's procurement timeline shows too — the Nashville RFI for surveillance integration went out right at the end of that window. Worth correlating.",
      },
      {
        event_id: "$012",
        sender: alice,
        ts: "2026-04-26T03:42:00Z",
        body:
          "Same registered agent. Delaware shell pattern. Sending the screenshots over secure transfer in a minute.",
      },
    ],
  },
  {
    room_id: "!eviction-tracker:hyphae.intelechia.com",
    subject: "January filings — final numbers",
    last_activity_ts: "2026-04-25T22:05:00Z",
    participants: [research],
    unread: false,
    tags: ["work", "data"],
    messages: [
      {
        event_id: "$020",
        sender: research,
        ts: "2026-04-25T22:05:00Z",
        body:
          "Final tally is 21,247 detainer warrants for the month, 51% increase YoY. McCoy holds 33% of filings, Lybarger 32%. District 19 is again the highest concentration. Full breakdown attached as CSV — let me know if you want the geocoded shapefile too.",
      },
    ],
  },
  {
    room_id: "!ntoa-records:matrix.org",
    subject: "Re: open records request — MNPD LPR procurement",
    last_activity_ts: "2026-04-25T14:33:00Z",
    participants: [ntoa],
    unread: false,
    messages: [
      {
        event_id: "$030",
        sender: ntoa,
        ts: "2026-04-22T11:00:00Z",
        body:
          "Acknowledging receipt of your open records request submitted on 4/21. Estimated response window is 7 business days. Reference number is provided below.",
      },
      {
        event_id: "$031",
        sender: me,
        ts: "2026-04-25T14:33:00Z",
        body: "Thanks — flagging this so I remember to follow up if I haven't heard back by Friday.",
      },
    ],
  },
  {
    room_id: "!editorial:richtext.email",
    subject: "Draft: 'The Owl and the Oracle' — second pass notes",
    last_activity_ts: "2026-04-24T16:18:00Z",
    participants: [editor],
    unread: false,
    starred: true,
    tags: ["writing"],
    messages: [
      {
        event_id: "$040",
        sender: editor,
        ts: "2026-04-24T16:18:00Z",
        body:
          "Read through twice. The Codd-to-Ellison-to-NULL arc is doing real work and I'd resist the urge to over-explain it — readers who get it will get it, and the ones who don't will get carried by the prose.\n\nOne suggestion: the section on Oracle's CIA origins reads like footnote material right now. Either expand it into a proper hinge moment or compress it to a sentence in the lede. The middle ground undersells it.\n\nHappy to talk through this anytime.",
      },
    ],
  },
  {
    room_id: "!eo-discussion:hyphae.intelechia.com",
    subject: "EO operators — DEF/REC concurrent write semantics",
    last_activity_ts: "2026-04-23T11:47:00Z",
    participants: [alice],
    unread: false,
    tags: ["eo", "technical"],
    messages: [
      {
        event_id: "$050",
        sender: alice,
        ts: "2026-04-23T11:47:00Z",
        body:
          "Re-reading the operator semantics. If two nodes both DEF the same field on the same target while offline, MVR keeps both values until reconciliation; LWW picks the later timestamp. Are you committing to MVR for DEF, or is this still an open call?\n\nAsking because the Khora event store has cases where conflicting DEFs are actually meaningful (two paralegals updating the same field is a workflow problem, not a data problem) and surfacing the conflict matters more than auto-resolving it.",
      },
    ],
  },
];
