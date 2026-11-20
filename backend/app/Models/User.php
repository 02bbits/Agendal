<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * @property bool $llm_enabled
 * @property string|null $llm_model
 * @property array<string, array{key: string, models: list<string>}>|null $llm_keys
 */
#[Fillable(['email', 'display_name', 'password', 'timezone', 'timezone_auto', 'remember_device', 'theme', 'week_start', 'time_format', 'install_prompt_shown', 'theme_palette', 'page_view', 'llm_enabled', 'llm_model'])]
#[Hidden(['password', 'remember_token', 'llm_keys'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** @var array<string, mixed> Matches the column default, so a user made in this request has AI on too. */
    protected $attributes = ['llm_enabled' => true];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'immutable_datetime',
            'timezone_auto' => 'boolean',
            'remember_device' => 'boolean',
            'install_prompt_shown' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'llm_enabled' => 'boolean',
            // provider id => ['key' => …, 'models' => [...]]; never leaves the server (Settings › AI)
            'llm_keys' => 'encrypted:array',
            'password' => 'hashed',
        ];
    }
}
