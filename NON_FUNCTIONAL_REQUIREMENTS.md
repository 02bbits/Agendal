## Non-Functional Requirements


| ID | Area | Requirement |
|---|---|---|
| NF-1 | Accessibility | Meets WCAG 2.2 AA: text contrast ≥ 4.5:1 and control borders ≥ 3:1 in both themes; colour never carries meaning alone |
| NF-2 | Accessibility | Touch targets ≥ 44 × 44px; every icon-only button has an accessible name; visible 2px focus ring on every control; full keyboard use; respects reduced-motion |
| NF-3 | Accessibility | Works with VoiceOver and TalkBack; status changes ("Listening…", "Reading file…", toasts) are announced |
| NF-4 | Performance | First load interactive in ≤ 3 s on a mid-range phone over 4G; repeat loads from cache in ≤ 1 s |
| NF-5 | Performance | A note of up to 10 items is processed and its result shown in ≤ 2 s (p90) when online |
| NF-6 | Offline | All lists, task edits and note capture work offline; changes queue and sync on reconnect without loss; conflicts resolve last-write-wins per field |
| NF-7 | Platform | Installable PWA (manifest, service worker, icons); supports the last two versions of Chrome, Safari (iOS 16.4+), Samsung Internet, Firefox and Edge |
| NF-8 | Layout | Fluid from 320px to 480px wide (360px reference), centred column up to 600px, `100dvh` height, safe-area insets respected; no native status bar or keyboard drawn |
| NF-9 | Privacy | Notes, attached files and tasks belong to the account holder only; files are used to extract text and are not kept after extraction unless the user saves them; no note content in analytics |
| NF-10 | Security | Passwords hashed (never stored or logged in plain text); HTTPS only; sign-in lockout per AA-3; reset links single-use and expire in 60 minutes |
| NF-11 | Reliability | No task change is lost: every applied note is stored with enough to undo it (before/after values) |
| NF-12 | Content | Follows the theme guide's voice: sentence case, 24-hour times, short dates, no emoji |
