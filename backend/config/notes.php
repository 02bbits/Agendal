<?php

// Plain values and env() only: tests load this file before the app boots.
return [

    // Vocabulary and punctuation shared by the note splitter and field extractor (NU §2.2, §2.5).
    'rules' => env('NOTE_RULES_PATH', dirname(__DIR__).'/resources/notes/note-rules.csv'),

    // Characters allowed after normalising (NU §2.1, note.too_long).
    'max_length' => (int) env('NOTE_MAX_LENGTH', 5000),

    // Items allowed after merging comma lists (NU-E14, note.too_many_items).
    'max_items' => (int) env('NOTE_MAX_ITEMS', 30),

    // Calendar days a yearless explicit date may lie in the past and still stay this year (NU-E4).
    'overdue_grace_days' => (int) env('NOTE_OVERDUE_GRACE_DAYS', 30),

    // Changes one note may make before it needs Apply changes (BR-01, NU-5).
    'changes_before_confirm' => (int) env('NOTE_CHANGES_BEFORE_CONFIRM', 5),

    // Share of a command's meaningful words a task title must contain to match (NU §2.4).
    'match_threshold' => (float) env('NOTE_MATCH_THRESHOLD', 0.6),

    // Open tasks fetched as candidates for one command, best trigram relevance first (NU §2.4).
    'match_candidates' => (int) env('NOTE_MATCH_CANDIDATES', 50),

    // Tied tasks offered in "Which task did you mean?" (NU-E11).
    'tie_choices' => (int) env('NOTE_TIE_CHOICES', 5),

];
