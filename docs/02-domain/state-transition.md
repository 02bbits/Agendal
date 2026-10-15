# State Transitions

| # | From | Event | To | Actor | Guard / Rule | Ref |
|---|---|---|---|---|---|---|
| T1 | — | Create | Open | User, Assistant | Title present | FR-09, FR-23 |
| T2 | Open | Edit fields | Open | User, Assistant | Scheduled end > start (BR-01) | FR-14, FR-24, FR-30 |
| T3 | Open | Complete | Completed | User, Assistant | — | FR-14, FR-27, FR-47 |
| T4 | Completed | Reopen | Open | User | — | FR-28 |
| T5 | Open / Completed | Delete | (removed) | User, Assistant | User confirms (BR-05) | FR-21, FR-26 |
| T6 | Open | Split | (removed) + N × Open | Assistant | User asked to split | FR-15 |
| T7 | Completed (repeating) | — | creates new Open occurrence | System | At most one per series + date (BR-08) | FR-41, NFR-23 |
| T8 | any | Undo assistant reply | state before that reply | User | Whole change set, one transaction | FR-20, NFR-21 |

Every assistant-initiated transition goes through the same authorization and validation as a manual one (NFR-11, NFR-13).
