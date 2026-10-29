# Test the IM-32 splitter yourself

First install the backend dependencies with `composer install` under PHP **8.4+** with Intl and Mbstring.

`backend/phpunit.xml` sets the test process memory limit to **1 GB** (`1024M`), including when the local PHP default is unlimited. No extra memory flag is needed when running Pest.

The dynamic scenario generator lives only in `backend/tests/Support/NoteSplitterScenarios.php`, under the `Tests\Support` namespace. Pest generates original, uppercase, padded and decomposed-accent cases from every CSV rule, plus project names, control characters, item/character limits, numeric commas and decimal times. Run them with:

```sh
php vendor/bin/pest tests/Unit/Services/NoteSplitterDynamicTest.php
php vendor/bin/pest tests/Unit/Services/NoteSplitterDynamicTest.php --filter="numeric 9:30"
```

Application code does not load the test generator. Generated scenario execution belongs to Pest and requires no database, web server or OpenRouter key.

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

Edit `backend/resources/notes/note-rules.csv` from the repository root. Its columns are `category,value`. Values are **literal text**, not regex. The categories define task verbs, command verbs, skip prefixes, complete suffixes (`is done`, `xong rồi`), independent date/time/priority/project signals, time units after a number (`9am`, `3 days`, `9 giờ`), time prefixes before an hour (`at 14`, `lúc 9`), lead-ins skipped before the verb check (`please`, `nhớ`), list joiners trimmed at item edges (`and`, `và`), abbreviations, bullets, semicolon separators and sequencing words. Punctuation is data too: `number_suffix`/`letter_suffix` (`1.`, `a)`), `checkbox_mark`, `comma`, `full_stop`, `time_separator` (`26/10`, `9:30`) and `word_attachment` (characters that glue a word into an email, file name or URL). Project keywords use one category per project, `project_keyword:<Project>` (e.g. `project_keyword:Personal,mum`); a keyword stops a comma merge only when the user has that project (NU-E34, any case). `leading_filler` (`thì`) is dropped only at the start of an item. A space inside a value matches any run of whitespace. An apostrophe matches a straight or curly one, and longer values win over shorter ones (`rồi thì` before `rồi`). Each new splitter category needs a template in `tests/Support/NoteSplitterScenarios.php`; each new field-extractor category (dates, times, priority, repeat, reminder, title casing) needs one in `tests/Support/NoteExtractionScenarios.php`. Families such as `weekday:1`, `month:10`, `time_word:09:00`, `repeat:weekly` and `date_offset:2` carry their value after the colon. Add a scenario proving any changed rule, then rerun Pest. The rules file path and the length and item limits live in `backend/config/notes.php` (`NOTE_RULES_PATH`, `NOTE_MAX_LENGTH`, `NOTE_MAX_ITEMS`); the generated boundary tests follow them. Rules are cached within one PHP process; restart a long-lived worker after editing them.

The fixed structural decisions remain in the PHP splitter: normalize before limits; preserve digit commas and decimal/file dots; only comma fragments can merge; `and`/`và` do not split; Vietnamese sequence words require following text; count items after merging. These follow NU §2.2 and business rules. CSV storage does not introduce CSV quoting semantics into ordinary note text.
