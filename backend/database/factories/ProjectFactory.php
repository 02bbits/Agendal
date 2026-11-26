<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A project as POST /projects makes it.
 *
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $now = Carbon::instance(app(ClockInterface::class)->now());

        return [
            // Set here: a seeder runs without model events, so HasUuids would not fill it
            'id' => (string) Str::uuid7(),
            'user_id' => User::factory(),
            'name' => Str::limit(rtrim(fake()->unique()->sentence(2), '.'), StoreProjectRequest::MAX_NAME_LENGTH, ''),
            'colour' => fake()->randomElement(StoreProjectRequest::ALLOWED_COLOURS),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
