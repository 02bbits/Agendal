<?php

declare(strict_types=1);

namespace App\Enums;

/** A change a note applied, as the note result and the notes.applied log name it (ADR-002). */
enum ChangeKind: string
{
    case Created = 'created';
    case Updated = 'updated';
    case Deleted = 'deleted';
}
