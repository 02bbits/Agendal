<?php

// Plain values and env() only: tests load this file before the app boots.
return [

    // Vocabulary and punctuation used by the note splitter (NU §2.2).
    'rules' => env('NOTE_RULES_PATH', dirname(__DIR__).'/resources/notes/splitter-rules.csv'),

    // Characters allowed after normalising (NU §2.1, note.too_long).
    'max_length' => (int) env('NOTE_MAX_LENGTH', 5000),

    // Items allowed after merging comma lists (NU-E14, note.too_many_items).
    'max_items' => (int) env('NOTE_MAX_ITEMS', 30),

];
