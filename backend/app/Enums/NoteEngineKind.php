<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the notes_engine check constraint. */
enum NoteEngineKind: string
{
    case Rules = 'rules';
    case RulesWithLlm = 'rules_llm';
    case RulesFallback = 'rules_fallback';
}
