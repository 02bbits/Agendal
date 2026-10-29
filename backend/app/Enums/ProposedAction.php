<?php

declare(strict_types=1);

namespace App\Enums;

/** What the language model may propose for one low-confidence item (ADR-008). */
enum ProposedAction: string
{
    case Create = 'create';
    case Complete = 'complete';
    case Reschedule = 'reschedule';
    case Delete = 'delete';
    case Skip = 'skip';
}
