<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

// SC-10: a signed-in request only ever sees its own rows. Route model binding goes through
// this scope too, so someone else's ID is a 404 and never reveals that the row exists.
// Jobs run without a user and see every row.
trait OwnedByUser
{
    protected static function bootOwnedByUser(): void
    {
        static::addGlobalScope('owner', function (Builder $query) {
            if (Auth::check()) {
                $query->where($query->qualifyColumn('user_id'), Auth::id());
            }
        });

        static::creating(function (Model $model) {
            $model->setAttribute('user_id', $model->getAttribute('user_id') ?? Auth::id());
        });
    }
}
