<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed for a skipped item's reason in the note result contract. */
enum SkipReason: string
{
    case Skip = 'skip';
    case AlreadyDone = 'already_done';
    case NotFound = 'not_found';
}
