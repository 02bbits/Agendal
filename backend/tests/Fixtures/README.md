# Test the IM-32 splitter yourself

First install the backend dependencies with `composer install` under PHP **8.4+** with Intl and Mbstring.

The executable scenarios are defined in `backend/app/Console/Support/NoteSplitterScenarios.php`, and run through the application's `SplitNoteCommand`. They are not limited to a test file. Every CSV rule generates original, uppercase, padded and decomposed-accent inputs automatically. The generator also covers projects, control characters, empty notes, all separators, 29/30/31-item boundaries, post-merge counts, 4,999/5,000/5,001 Unicode-character limits, numeric commas and decimal times. Adding a rule creates new cases on the next run; adding an unknown rule category fails until scenario templates are supplied.

From `backend/`, try any note or run the generated scenarios **without Pest**:

```sh
php artisan notes:split "buy milk, eggs and bread; call mum tomorrow"
php artisan notes:split "buy ink, Research (2026) outline" --project="Research (2026)"
php artisan notes:split --file="my-note.txt"
php artisan notes:split --scenarios
php artisan notes:split --scenarios --filter="numeric 9:30"
```

The command prints actual split items as JSON. Scenario mode reports PASS/FAIL by name, shows expected and actual output on failure, and returns a failing exit code if a case fails or the filter matches nothing. These checks use the real Laravel splitter; no database, web server or OpenRouter is required. Pest consumes the same generated scenarios as regression tests:

```sh
php vendor/bin/pest tests/Unit/Services/NoteSplitterDynamicTest.php
```

Use PHP **8.4+** with Intl and Mbstring. From the repository root:

```sh
cd backend
composer install
php vendor/bin/pest tests/Unit/Services/NoteSplitterTest.php
```

These splitter tests need no database, browser, server or OpenRouter key. Each CSV row appears as a named test; failures show the expected and actual items. To run one scenario:

```sh
php vendor/bin/pest tests/Unit/Services/NoteSplitterTest.php --filter=EN-groceries
```

Edit `note-splitter-scenarios.csv` in a CSV editor, spreadsheet app or text editor. Save as UTF-8 CSV; UTF-8 BOM and CRLF are accepted. Keep the header:

| Column | Enter |
|---|---|
| `id` | A unique scenario name |
| `note` | Your real note; quoted CSV cells can contain newlines, commas and quotes |
| `projects_json` | Known project names, e.g. `["Portfolio"]`, or `[]` |
| `expected_json` | Expected items in order, e.g. `["buy milk, eggs and bread"]` |
| `error` | Leave empty for success; otherwise `note.empty`, `note.too_long`, or `note.too_many_items` |

JSON quotes inside a raw CSV cell must be doubled by the CSV editor. Spreadsheet apps handle this when saving. The checked-in rows show the correct escaping.

The cases cover shopping lists, independent commands, dates, times, priorities, projects, English/Vietnamese sequences, bullets, CRLF, accents, numbers, email/file names, literal quotes and the 30-item boundary. Long-note limits and normalization also have explicit Pest tests in `NoteSplitterTest.php`.

## Change a vocabulary rule

Edit `backend/resources/notes/splitter-rules.csv` from the repository root. Its columns are `category,value`. Values are **literal text**, not regex. The categories define task verbs, command verbs, skip prefixes, independent date/time/priority/project signals, abbreviations, bullets, semicolon separators and sequencing words. Add a scenario proving any changed rule, then rerun Pest. Rules are cached within one PHP process; restart a long-lived worker after editing them.

The fixed structural decisions remain in the PHP splitter: normalize before limits; preserve digit commas and decimal/file dots; only comma fragments can merge; `and`/`và` do not split; Vietnamese sequence words require following text; count items after merging. These follow NU §2.2 and business rules. CSV storage does not introduce CSV quoting semantics into ordinary note text.
