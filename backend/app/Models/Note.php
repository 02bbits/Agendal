<?php

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    use HasUuids, OwnedByUser;

    const UPDATED_AT = null;
}
