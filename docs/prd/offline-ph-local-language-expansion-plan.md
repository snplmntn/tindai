# Offline Philippine Local Language Expansion Plan

## 1. Purpose

This document expands the Tindai MVP language strategy so the app can handle more Philippine local language input while offline. It is a companion to `docs/prd/tindai-hackathon-mvp-prd.md`, which currently prioritizes demo-safe Taglish commands and online Gemini verification.

The goal is not full natural-language understanding. The goal is reliable offline inventory updates for common sari-sari store commands in Tagalog, Filipino, Taglish, Bisaya/Cebuano, and other Philippine language variants through deterministic parsing, local aliases, confidence scoring, and quick correction.

## 2. Current PRD Gap

The current PRD supports:

- Taglish voice commands for the main demo flow.
- A lightweight offline parser.
- Quantity detection from Tagalog, English, and numeric forms.
- Dynamic item aliases from local inventory.
- Online Gemini verification for better parsing and normalization.
- Manual plus/minus fallback when speech recognition or parsing fails.

The current PRD does not yet define:

- Offline support for Bisaya/Cebuano quantities and sales phrases.
- Offline support for Ilocano, Hiligaynon, Waray, Kapampangan, Bicolano, or other local languages.
- A structured language-pack model.
- Offline text normalization for spelling variants and STT errors.
- Confidence scoring rules for multilingual parsing.
- A repeatable test corpus for Philippine local language commands.

## 3. Design Principles

- Local-first: inventory updates must not depend on Gemini or network access.
- Deterministic: offline parsing should use predictable rules, not an on-device LLM.
- Store-specific: item matching should prefer the store's local inventory names and aliases.
- Confirm when uncertain: low-confidence parses should ask for one-tap confirmation before applying stock changes.
- Small surface first: support high-frequency inventory commands before broader conversation.
- Language packs: add local language support as structured data that can be expanded without rewriting the parser.
- Raw text preserved: every voice or typed input should be saved even when parsing fails.

## 4. Supported Offline Scope

### P0 Languages

P0 is the hackathon-safe scope.

- Tagalog / Filipino
- Taglish
- Bisaya / Cebuano for common inventory flows
- English numerals and numeric digits mixed into any command

### P1 Languages

P1 should be added after P0 tests are passing.

- Hiligaynon / Ilonggo
- Ilocano
- Waray
- Kapampangan
- Bicolano

### P2 Languages

P2 is post-MVP expansion.

- Chavacano
- Pangasinan
- Tausug
- Maguindanaon
- Maranao
- Other store-owner-specific terms collected from real use

## 5. Offline Command Types

### P0 Command Types

- Sale / decrement inventory.
- Restock / increment inventory.
- Utang / credit sale with customer name.
- Multi-item sale in one sentence.
- Manual typed command using the same parser path.

### Deferred Command Types

- Returns and refunds.
- Supplier orders.
- Expenses.
- Price changes.
- Complex analytics questions.
- Free-form conversational assistant replies.

## 6. Offline Language-Pack Model

Each language pack should be a local JSON-like structure bundled with the app. It should include normalized vocabulary for quantities, intents, connectors, credit cues, and filler words.

Example shape:

```json
{
  "id": "ceb",
  "label": "Bisaya / Cebuano",
  "quantities": {
    "usa": 1,
    "isa": 1,
    "duha": 2,
    "tulo": 3,
    "upat": 4,
    "lima": 5
  },
  "sale_verbs": [
    "baligya",
    "nabaligya",
    "nakabaligya",
    "nahalin",
    "gikuha"
  ],
  "restock_verbs": [
    "dugang",
    "nadungag",
    "abot",
    "gi stock"
  ],
  "credit_cues": [
    "utang",
    "lista",
    "ilistang",
    "ilista",
    "bayran sunod"
  ],
  "connectors": [
    "ug",
    "unya",
    "at",
    "and"
  ],
  "filler_words": [
    "ko",
    "ako",
    "ka",
    "og",
    "sa",
    "ang"
  ]
}
```

P0 language packs should include:

- `tgl`: Tagalog / Filipino.
- `ceb`: Bisaya / Cebuano.
- `en`: English and numeric fallback terms.
- `mixed`: shared Taglish and code-switching terms.

## 7. Text Normalization

Before parsing, the app should normalize recognized or typed text:

1. Lowercase the input.
2. Remove punctuation that does not affect meaning.
3. Normalize repeated spaces.
4. Convert numeric words from all enabled language packs into numbers.
5. Normalize common STT spelling variants.
6. Preserve original `raw_text` in the transaction audit trail.

Examples:

| Raw input | Normalized input |
| --- | --- |
| `Nakabenta ako ng dalawang Coke Mismo.` | `nakabenta ako ng 2 coke mismo` |
| `Nabaligya kog duha ka Coke` | `nabaligya ko 2 coke` |
| `Ilista mo muna si Mang Juan, 2 Coke` | `ilista muna si mang juan 2 coke` |
| `Tatlong itlog nabenta` | `3 itlog nabenta` |

## 8. Local Item Alias Strategy

Every inventory item should support multilingual aliases. Aliases are store-specific and stored locally with the item record.

Example:

```json
{
  "name": "Coke Mismo",
  "aliases": [
    "coke",
    "coke mismo",
    "coca cola",
    "kok",
    "softdrinks coke"
  ]
}
```

For Bisaya-heavy stores, the item alias list can include local descriptions:

```json
{
  "name": "Eggs",
  "aliases": [
    "egg",
    "eggs",
    "itlog",
    "bugas itlog",
    "pinutos itlog"
  ]
}
```

Alias matching rules:

- Exact alias match has highest confidence.
- Case-insensitive match is treated as exact after normalization.
- Multi-word aliases are preferred over single-word aliases.
- Fuzzy matching may suggest an item, but should require confirmation below the confidence threshold.
- If two items match the same spoken phrase, ask the user to choose.

## 9. Parser Architecture

The offline parser should be split into small steps:

1. `normalizeText(rawText, enabledLanguagePacks)`.
2. `detectIntent(normalizedText, enabledLanguagePacks)`.
3. `detectCredit(normalizedText, enabledLanguagePacks)`.
4. `extractCustomer(normalizedText, customerAliases)`.
5. `extractItemQuantities(normalizedText, itemAliasIndex, enabledLanguagePacks)`.
6. `scoreParse(candidateParse)`.
7. `return parsed transaction or confirmation request`.

Recommended output:

```json
{
  "raw_text": "Nabaligya kog duha ka Coke ug usa ka Safeguard",
  "normalized_text": "nabaligya ko 2 coke ug 1 safeguard",
  "language_hints": ["ceb", "en"],
  "intent": "sale",
  "confidence": 0.88,
  "status": "needs_confirmation",
  "items": [
    {
      "spoken_name": "coke",
      "matched_item_name": "Coke Mismo",
      "quantity_delta": -2,
      "match_confidence": 0.9
    },
    {
      "spoken_name": "safeguard",
      "matched_item_name": "Safeguard",
      "quantity_delta": -1,
      "match_confidence": 1
    }
  ],
  "credit": {
    "is_utang": false,
    "customer_name": null
  },
  "notes": []
}
```

## 10. Confidence Rules

Suggested confidence thresholds:

- `>= 0.85`: apply inventory update immediately.
- `0.60 to 0.84`: show one-tap confirmation before applying.
- `< 0.60`: do not apply automatically; save raw text and offer manual correction.

Confidence should consider:

- Intent detected clearly.
- Quantity detected clearly.
- Item matched exactly or fuzzily.
- Multiple item boundaries detected correctly.
- Credit intent and customer name detected consistently.
- Parser had to guess missing quantity or item.

High confidence example:

`Nakabenta ako ng dalawang Coke Mismo`

Expected:

- Sale intent: clear.
- Quantity: `dalawang` = 2.
- Item: exact alias.
- Action: decrement immediately.

Medium confidence example:

`Nabaligya duha coke`

Expected:

- Sale intent: likely.
- Quantity: clear.
- Item: fuzzy or alias match.
- Action: ask `Bawas 2 Coke Mismo?`

Low confidence example:

`Kuan kato ganina kang Juan`

Expected:

- Intent unclear.
- No item or quantity.
- Action: save raw text, show manual options.

## 11. Offline Confirmation UX

When confidence is medium, the app should show a compact confirmation row:

`Bawas 2 Coke Mismo?`

Actions:

- Confirm.
- Edit quantity.
- Change item.
- Mark as utang.
- Cancel.

For multi-item commands:

`Bawas 2 Coke Mismo + 1 Safeguard?`

For utang commands:

`Utang ni Mang Juan: 2 Coke Mismo?`

The confirmation should work offline and should create a transaction only after confirmation, unless the parse is high confidence.

## 12. Offline Fallback Controls

If STT or parsing fails, the app should offer fast structured fallback:

- Intent chips: `Bawas`, `Dagdag`, `Utang`.
- Quantity stepper: `-`, number, `+`.
- Item picker filtered by local aliases.
- Customer picker for utang.
- Confirm button.

This keeps the app usable for dialects and noisy environments while preserving the voice-first flow.

## 13. Test Corpus Plan

Create an offline language test corpus with real commands. Store test cases as structured JSON so parser changes can be measured.

Recommended file:

`mobile/src/features/voice-parser/__tests__/fixtures/ph-local-language-commands.json`

Example:

```json
[
  {
    "id": "tgl-sale-001",
    "language": "tgl",
    "raw_text": "Nakabenta ako ng dalawang Coke Mismo",
    "expected": {
      "intent": "sale",
      "items": [
        { "name": "Coke Mismo", "quantity_delta": -2 }
      ],
      "credit": { "is_utang": false }
    }
  },
  {
    "id": "ceb-sale-001",
    "language": "ceb",
    "raw_text": "Nabaligya kog duha ka Coke",
    "expected": {
      "intent": "sale",
      "items": [
        { "name": "Coke Mismo", "quantity_delta": -2 }
      ],
      "credit": { "is_utang": false }
    }
  }
]
```

Initial target corpus:

- 50 Tagalog / Filipino commands.
- 50 Taglish commands.
- 50 Bisaya / Cebuano commands.
- 25 utang commands across Tagalog, Taglish, and Bisaya.
- 25 noisy or ambiguous commands that should require confirmation or fallback.

## 14. Accuracy Metrics

Track parser performance with these metrics:

- Intent accuracy: sale, restock, utang, unknown.
- Quantity accuracy.
- Item match accuracy.
- Multi-item parse accuracy.
- Credit detection accuracy.
- Customer extraction accuracy.
- Safe failure rate for ambiguous commands.
- False auto-apply rate.

Suggested release gates:

- P0 demo gate: 100 percent pass rate on the 5 rehearsed demo commands.
- P0 parser gate: at least 90 percent exact match on core Tagalog, Taglish, and Bisaya sale commands.
- Safety gate: 0 high-confidence auto-applies for commands that should be unknown.
- Utang gate: at least 85 percent correct credit detection on the P0 utang corpus.

## 15. Implementation Plan

### Phase 1: Parser Baseline

Goal: make the current offline parser measurable and extendable.

Tasks:

- Create a dedicated parser module.
- Add normalized parser output with `raw_text`, `normalized_text`, `language_hints`, `intent`, `confidence`, `items`, `credit`, and `notes`.
- Add a local item alias index.
- Add unit tests for the 5 PRD demo commands.
- Add test fixtures for Tagalog and Taglish.

Acceptance criteria:

- All current demo commands pass.
- Parser returns confidence and structured failure output.
- No cloud call is required for parsing.

### Phase 2: Language Packs

Goal: support multiple local language vocabularies without changing parser logic.

Tasks:

- Add `tgl`, `ceb`, `en`, and `mixed` language packs.
- Move quantity words, intent words, connectors, and credit cues into language-pack data.
- Add normalized quantity detection across all enabled packs.
- Add language hint detection based on matched vocabulary.
- Add unit tests for Bisaya quantities and sales phrases.

Acceptance criteria:

- Bisaya commands using `usa`, `duha`, and `tulo` parse correctly.
- Mixed commands such as `Nabaligya 2 Coke ug isa ka Safeguard` parse correctly.
- Adding a new language pack does not require rewriting parser core logic.

### Phase 3: Confidence and Confirmation

Goal: prevent wrong offline inventory updates.

Tasks:

- Implement parser confidence scoring.
- Define auto-apply, confirmation, and failure thresholds.
- Add parser status values: `ready_to_apply`, `needs_confirmation`, `unparsed`.
- Connect medium-confidence results to a confirmation UI state.
- Save low-confidence raw text as pending manual review.

Acceptance criteria:

- High-confidence demo commands update inventory immediately.
- Medium-confidence commands require one-tap confirmation.
- Ambiguous commands do not change inventory automatically.

### Phase 4: Offline Fallback Flow

Goal: keep the app useful when STT or parsing fails.

Tasks:

- Add fallback action chips for sale, restock, and utang.
- Add quantity selector.
- Add alias-aware item search.
- Add customer picker for utang.
- Route fallback submissions through the same transaction creation path.

Acceptance criteria:

- A user can complete a sale offline without voice.
- A user can complete an utang entry offline without voice.
- Manual fallback transactions still appear in the audit trail.

### Phase 5: Expanded Corpus and Regression Testing

Goal: make language support measurable before demos and releases.

Tasks:

- Add 200 structured local language test cases.
- Add parser regression tests that run against the full corpus.
- Add a metrics summary command for parser accuracy.
- Review false positives manually before demo.

Acceptance criteria:

- Corpus tests pass release gates.
- Accuracy summary is available before rehearsal.
- New language-pack changes cannot silently break existing demo commands.

## 16. Initial P0 Vocabulary

### Quantities

Tagalog / Filipino:

- `isa`, `isang`, `iisa`: 1
- `dalawa`, `dalawang`: 2
- `tatlo`, `tatlong`: 3
- `apat`, `apat na`: 4
- `lima`, `limang`: 5

Bisaya / Cebuano:

- `usa`, `isa`: 1
- `duha`: 2
- `tulo`: 3
- `upat`: 4
- `lima`: 5

English / numeric:

- `one`, `two`, `three`, `four`, `five`
- `1`, `2`, `3`, `4`, `5`

### Sale / Decrement Cues

Tagalog / Filipino:

- `nakabenta`
- `nabenta`
- `bawas`
- `binili`
- `kumuha`
- `nakuha`

Bisaya / Cebuano:

- `nabaligya`
- `nakabaligya`
- `baligya`
- `nahalin`
- `gikuha`
- `kuha`

English / Taglish:

- `sold`
- `sale`
- `minus`
- `bawas`

### Restock / Increment Cues

Tagalog / Filipino:

- `dagdag`
- `nadagdagan`
- `dumating`
- `nag restock`
- `restock`

Bisaya / Cebuano:

- `dugang`
- `nadungag`
- `abot`
- `niabot`
- `gi stock`

English / Taglish:

- `add`
- `added`
- `restock`
- `stock in`

### Utang / Credit Cues

Shared:

- `utang`
- `lista`
- `ilista`
- `palista`
- `credit`
- `bayaran mamaya`
- `bayran sunod`
- `muna`

## 17. Demo Command Set

Use these commands for rehearsal after implementation:

- `Nakabenta ako ng dalawang Coke Mismo at isang Safeguard.`
- `Tatlong itlog nabenta.`
- `Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna.`
- `Nabaligya kog duha ka Coke.`
- `Usa ka Safeguard giutang ni Aling Maria.`
- `Dugang lima ka itlog.`
- `Sold 2 Coke ug 1 Safeguard.`
- `Palista si Junjun, tulo ka itlog.`

## 18. Gemini Sync Interaction

Offline parsing should remain the source of immediate app behavior. Gemini should only verify and normalize after sync.

When online, send Gemini:

- `raw_text`
- `normalized_text`
- local parse result
- confidence
- language hints
- inventory context
- customer context

If Gemini disagrees:

- Preserve the original local transaction.
- Create a correction movement if stock changed incorrectly.
- Mark the transaction as verified with notes.
- Do not delete raw text or the original local parse.

## 19. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Native STT outputs poor text for local languages | Support typed input and structured fallback controls. |
| Bisaya words overlap with Tagalog or item names | Use item alias priority, phrase context, and confirmation. |
| Parser falsely applies stock changes | Use confidence thresholds and confirmation for medium confidence. |
| Language packs become hard to maintain | Keep them data-only and covered by corpus tests. |
| Too many dialects for MVP | Ship P0 Tagalog, Taglish, and Bisaya first; collect real examples for P1. |
| Multi-item parsing creates wrong boundaries | Prefer high-confidence exact alias spans; ask confirmation when ambiguous. |

## 20. Owner Assignments

- Voice AI / Parser owner: language packs, normalization, parser logic, confidence scoring, corpus tests.
- Inventory owner: item aliases, local item search, transaction application path.
- Backend owner: TypeScript backend, Gemini verification payload, and correction movement handling.
- QA / Growth owner: collect real utterances from sari-sari store owners and classify them into the test corpus.
- Analytics owner: parser metrics summary and rehearsal readiness report.

## 21. Definition of Done

This expansion is ready for MVP use when:

- The app can parse the 5 original PRD demo commands offline.
- The app can parse at least 5 Bisaya/Cebuano inventory commands offline.
- Medium-confidence parses show a confirmation before changing inventory.
- Low-confidence parses preserve raw text and offer manual fallback.
- The parser has a repeatable local test corpus.
- Parser tests report accuracy by language and command type.
- The demo script includes at least one successful Bisaya command.
