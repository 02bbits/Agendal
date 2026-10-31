<?php

declare(strict_types=1);

namespace App\Enums;

/** What a note item becomes (NU §2.3). */
enum ItemKind: string
{
    case Task = 'task';
    case Command = 'command';
    case Skip = 'skip';
}
