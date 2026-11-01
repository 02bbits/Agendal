<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * The demo account used across the docs (test strategy: test data).
     */
    public function run(ClockInterface $clock): void
    {
        $user = User::factory()->create([
            'email' => 'example@gmail.com',
            'display_name' => 'example',
        ]);

        // Colours from the theme guide's project examples
        $projects = [
            'SQL Course' => 'blue',
            'Adv Web' => 'red',
            'HCI' => 'orange',
            'Portfolio' => 'green',
            'Personal' => 'purple',
        ];

        foreach ($projects as $name => $colour) {
            DB::table('projects')->insert([
                'id' => Str::uuid7(),
                'user_id' => $user->id,
                'name' => $name,
                'colour' => $colour,
                'created_at' => $clock->now(),
                'updated_at' => $clock->now(),
            ]);
        }
    }
}
