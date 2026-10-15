# Usability

| ID | Name | Description |
|---|---|---|
| NFR-14 | Ease of use | A new user creates their first task with one assistant message, or within 3 taps manually, with no instructions. |
| NFR-15 | Assistant accuracy | On a test set of at least 100 sample messages, the assistant extracts the correct number of tasks in ≥ 90% of messages and the correct due date in ≥ 90% of tasks. The test set runs before any change of prompt or AI model. |
| NFR-16 | Customization | Users can choose light/dark theme, accent colour, first day of the week, morning summary time, and default reminder time. Preferences are saved to the profile and applied on every device. |
| NFR-17 | System feedback | Every action (save, delete, undo, error) shows a success message or a clear error. If the assistant fails, it says so and keeps the user’s message so they can resend it. |
| NFR-18 | Accessibility | The app meets WCAG 2.1 level AA. Touch targets are at least 44 × 44 px. Every voice feature has a typed alternative. |

## Responsive

| ID | Name | Description |
|---|---|---|
| NFR-19 | Mobile-first layout | Screens are designed for a 360 px wide phone first, then adapted for tablet and desktop (Tailwind responsive), with no horizontal scrolling. The assistant input stays fixed at the bottom within thumb reach. |
| NFR-20 | Installable PWA | The app has a web app manifest and service worker and passes Lighthouse PWA installability checks. The app shell opens without a connection. |
