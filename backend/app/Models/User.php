<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\TransientToken;
use SensitiveParameter;

#[Fillable(['email', 'display_name', 'password', 'timezone', 'timezone_auto', 'remember_device', 'theme', 'week_start', 'time_format', 'install_prompt_shown', 'theme_palette', 'page_view'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Sanctum types this as a PersonalAccessToken, but a request on the app's session carries a
     * TransientToken (every ability), and outside a request there is none (#196).
     *
     * @return PersonalAccessToken|TransientToken|null
     */
    public function currentAccessToken()
    {
        return $this->accessToken;
    }

    public function sendPasswordResetNotification(#[SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

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
            'password' => 'hashed',
        ];
    }
}
