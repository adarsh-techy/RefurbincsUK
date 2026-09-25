# RFID for Battery Scanning — Plan

> Companion to [`cerebrum.md`](./cerebrum.md). Written 2026-09-26.
> Goal: let workshop staff and clients identify a battery by tapping/reading an RFID tag
> instead of (or in addition to) scanning its QR code.

---

## 1. Why it fits easily

Every scan path in the app already ends up as a **plain battery code string**:

```
camera QR / scanner gun / typed code
        └─► extractBatteryCode(raw)          frontend/src/utils/extract-battery-code.js
                └─► GET /api/batteries/:code  → start-work / testing / sort / intake verify / returns …
```

RFID only has to produce that same string. Nothing downstream changes.

```
RFID tag on battery  ──►  RFID reader  ──►  battery code  ──►  existing flow
   ("HF-000123")           (USB/BLE/NFC)     "HF-000123"        (unchanged)
```

---

## 2. Options (pick by budget / volume)

| Option | Hardware | How it reaches the app | Code change | Best for |
|---|---|---|---|---|
| **A. NFC (13.56 MHz)** — *start here* | NFC stickers (NTAG213/215, ~£0.10–0.30 each) + **phone NFC** (Android; iPhone 7+) or USB desktop reader (ACR122U ~£30) | Mobile: `react-native-nfc-manager` reads the tag. Web: USB reader behaves as a **keyboard** → types code + Enter | Small | Bench scanning, one battery at a time, same 2–4 cm range as QR |
| **B. UHF RFID handheld** (860–960 MHz) | On-metal UHF tags (~£0.15–0.50) + handheld gun (Zebra RFD40, Chainway C72, Urovo ~£400–1500) | Most are Android and can pair as a **Bluetooth keyboard (HID)** → types code + Enter into any input | Small / none | Reading 1–5 m away, many batteries fast (truck intake, returns count) |
| **C. Fixed UHF gate / portal** | UHF tags + fixed reader (Impinj R700, Zebra FX9600 ~£1000–3000) + antennas at door / loading bay | Reader POSTs tag reads to a **new backend webhook** | Medium | Automatic intake/dispatch while trucks unload — no human scan |

Recommended path: **A → B → C**. A is cheap and works with phones already in use; B when volume justifies it; C is a later automation step.

---

## 3. Hardware notes

- **Metal kills ordinary tags.** Batteries are metal + high mass; plain RFID stickers will not read. Buy **on-metal / anti-metal** tags:
  - NFC: "NTAG213 on-metal", "NTAG216 anti-metal".
  - UHF: Confidex Ironside, Omni-ID, Xerafy.
- **Test before bulk order:** 5–10 tags on a real battery, check read range, check survival through the repair/testing cycle (heat, handling).
- **Placement:** flat, non-recessed area, same spot on every battery (so staff know where to tap). Print the battery code on the tag label too, as a human-readable fallback.
- **Phones:** Android with NFC reads and writes NDEF. iPhone 7+ reads NDEF; iPhone 7+ with iOS 13+ can write. Web NFC is Android Chrome only.
- **Readers in keyboard (HID) mode** may send `Tab` instead of `Enter` after the code — configurable on the device; the app should accept both.

Starter shopping list (~£40): 20 on-metal NFC tags + 1 ACR122U USB reader.

---

## 4. Tag content strategy (decide once)

| Strategy | Pros | Cons |
|---|---|---|
| **Write the battery URL onto the tag** (same content as the QR, e.g. `https://app…/batteries/HF-000123`) | Zero backend change; any NFC phone can open the battery page even outside the app | Tag can be rewritten unless locked |
| **Use the tag's factory UID / EPC** and store it in `batteries.rfid_tag` | Cannot be cloned or edited; UHF tags (B/C) always work this way | Every tag must be registered to a battery first |

**Do both:** write the URL as an NDEF text/URL record **and** store the UID in `rfid_tag` as a fallback. Lock NFC tags after writing (`NfcManager.ndefHandler.makeReadOnly()`).

---

## 5. Code changes

### 5.1 Database — 1 migration

```sql
-- backend/src/db/migrations/053_battery_rfid_tag.sql
-- Links a physical RFID/NFC tag (factory UID or EPC) to a battery so a tag read
-- can resolve to a battery exactly like a QR scan does.
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(64) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_batteries_rfid_tag ON batteries(rfid_tag);
```

### 5.2 Backend

1. **Lookup by tag** — `backend/src/models/battery.model.js` `findByCode`:
   ```sql
   WHERE b.battery_code = $1 OR b.rfid_tag = $1
   ```
   This single change makes every existing scan endpoint accept a tag ID.
2. **Assign a tag** — new `PATCH /api/batteries/:id/rfid-tag` (`requireRole('super_admin','admin')`), body `{ rfidTag }`. Copy the `updateSerialNumber` controller/model pattern. Handle `23505` (unique violation) → 409 "Tag already assigned to battery X". Record via `auditLogModel.record`.
3. **Return the field** — add `rfid_tag` to the battery SELECTs in `findByCode` / `findPage` so the detail page can show it.
4. **(Option C only)** `POST /api/rfid/events` webhook: `{ readerId, tagId, ts, antenna }`, authenticated with a per-reader API key (new `rfid_readers` table). Maps `readerId` → action (`intake_gate` → `verifyArrival`, `dispatch_gate` → add to open return). Debounce repeat reads of the same tag within N seconds.

### 5.3 Mobile (Expo)

- Add `react-native-nfc-manager`. Requires an **Expo dev build** (`npx expo prebuild` / EAS) — Expo Go does not include NFC.
- `app.json`:
  ```json
  "ios":     { "infoPlist": { "NFCReaderUsageDescription": "Scan battery RFID tags" }, "entitlements": { "com.apple.developer.nfc.readersession.formats": ["NDEF", "TAG"] } },
  "android": { "permissions": ["android.permission.NFC"] }
  ```
- New hook `mobile/src/utils/useNfcRead.js`:
  ```js
  await NfcManager.requestTechnology(NfcTech.Ndef);
  const tag = await NfcManager.getTag();
  const text = Ndef.text.decodePayload(tag.ndefMessage?.[0]?.payload) || tag.id;
  onScan(text);   // same handler the camera uses
  ```
- Add a **"Tap RFID"** button next to the camera button in `ServiceScreen.js`, `ClientScanScreen.js`, `ClientSortingScreen.js`, `BatteryDetailScreen.js`; pass the result through `extractBatteryCode()` exactly like a QR result.
- Admin **"Program tag"** screen: writes the battery URL as NDEF, then calls `PATCH /batteries/:id/rfid-tag` with `tag.id`, then makes the tag read-only.

### 5.4 Web

- HID readers type into the focused input — `TechnicianHomePage`, `TruckVerifyModal`, `ReturnForm`, `RecycleForm`, `ClientBatterySortPage` already handle "code + Enter". Tweak `handleManualKeyDown` (and equivalents) to also accept `Tab`.
- Optional Android-Chrome path: `useWebNfc()` hook beside `components/ui/primitives/QrScanner.jsx` using `new NDEFReader().scan()`; show the button only when `'NDEFReader' in window`.
- `BatteryDetailPage.jsx`: show `rfid_tag` in the identity card with an admin "Assign / Replace tag" action (USB reader or Web NFC fills the field).

### 5.5 Docs to update afterwards

- `cerebrum.md` §3.2 (lookup now matches `rfid_tag`), §3.3 table list, "Where to look for X" row for tag issues, fix log.

---

## 6. Rollout

| Step | Work | Effort |
|---|---|---|
| 1 | Order 20 on-metal NFC tags + ACR122U; test read range on a battery | 1 week lead time |
| 2 | Migration 053 + `findByCode` OR-match + return `rfid_tag` | ½ day |
| 3 | Assign-tag endpoint + `BatteryDetailPage` UI | ½ day |
| 4 | Mobile NFC read hook + "Tap RFID" buttons + Program-tag screen (dev build) | 2–3 days |
| 5 | Pilot on one client's fleet; compare scan time / error rate vs QR | 2 weeks |
| 6 | If intake/returns need bulk reads → UHF handheld in keyboard mode (no code change) | hardware only |
| 7 | Later: fixed gate readers + webhook (Option C) | 1–2 weeks |

---

## 7. Risks / open questions

- On-metal tag adhesion and heat tolerance through repair/testing — confirm with pilot.
- Expo dev build changes the mobile release process (EAS build instead of Expo Go).
- iOS NFC UX requires a system sheet per read; not suitable for rapid bulk scans — use Android or a UHF gun for that.
- Web NFC is Android Chrome only; desktop web must use a USB/BLE HID reader.
- Decide whether a battery may have **more than one** tag over its life (tag replacement) — current design is one `rfid_tag` per battery; replacing overwrites it.
