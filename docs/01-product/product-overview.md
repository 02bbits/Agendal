# Product Overview

Agendal is a mobile web app (PWA) for students. You write or say whatever is on your mind, and Agendal turns it into dated, organised tasks that you can review and undo. Lists come second, and the note comes first.

> *"sql quiz monday 9am, email the group tonight, buy printer ink tomorrow"* → three tasks: **SQL quiz** (Mon 09:00, High, SQL Course, reminder 1 day before), **Email the group** (today 20:00, Medium, reminder 15 minutes before), **Buy printer ink** (tomorrow, Low). The note is named "This week".

## How it works

1. **Write a note**: typed, dictated, or read from a file. No fields to fill in.
2. **Agendal builds a plan**: the tasks to create, change or delete, and any text to skip ([note understanding rules](../02-domain/business-rules.md)).
3. **Risky plans wait**: any delete, or more than 5 changes, needs *Apply changes* first. A note with nothing actionable gets one question.
4. **The result screen** lists every change, and **Undo all** reverses the whole note.

## What changed from the earlier concept

| V1 (chat assistant) | V2 (notes) |
|---|---|
| A back-and-forth chat with an assistant, with conversation history | A note is written once and turned into tasks. History is the Notes tab |
| The assistant also split tasks, found free time, answered "What should I do next?" | Not in v1. The assistant only creates, completes, reschedules and deletes tasks |
| Encouragement, nudges and morning summary, each with a toggle | A completion toast with Undo. No nudges or morning summary |
| Summary card per assistant reply | Note result screen with CREATED / CHANGED / DELETED badges |
| Requirement IDs FR-01–FR-67, NFR-1–NFR-27 | AA/NC/NU/RV/TK/LV/PJ/AP (41) and NF-1–NF-12 |

## Design

The look is **Paper & ink**: a calm, flat notebook in light and dark. See the [theme guide](theme-guide.md), the [design system](https://claude.ai/artifact/1tqQg3Ugsmxm6qJWyXaYpu) and the [prototype](https://claude.ai/artifact/7uABDQJSswS3pUAeSFNag8) (sign in with example@gmail.com).
