<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlanStatus;
use App\Enums\WeekStart;
use App\Models\Note;
use App\Models\Project;
use App\Models\User;
use App\Services\Clock\ClientClock;
use App\Services\Clock\ClockInterface;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\NoteApplier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Notes\TaskCandidates;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class ProcessNote
{
    public function __construct(
        private ClockInterface $clock,
        private NoteSplitter $splitter,
        private NoteEngine $engine,
        private CommandMatcher $matcher,
        private TaskCandidates $candidates,
        private NoteApplier $applier,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{note: Note, replay: bool}
     */
    public function handle(User $user, array $input): array
    {
        Validator::make($input, ['client_id' => ['required', 'uuid:4']])->validate();

        return DB::transaction(function () use ($user, $input): array {
            // Serializes client-id replays, open-task limits and notes from multiple devices.
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $existing = Note::query()->where('user_id', $user->id)->where('client_id', $input['client_id'])->first();
            if ($existing !== null) {
                return ['note' => $existing, 'replay' => true];
            }
            Validator::make($input, [
                'text' => ['required', 'string'],
                'written_at' => ['required', 'string', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/'],
                'timezone' => ['required', 'string'], 'source_file_name' => ['nullable', 'string', 'max:255'],
            ])->validate();
            try {
                $clientClock = ClientClock::fromWrittenAt($input['written_at'], $this->clock);
            } catch (InvalidArgumentException) {
                throw ValidationException::withMessages(['written_at' => ['error.invalid']]);
            }
            $zone = in_array($input['timezone'], DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true) ? $input['timezone'] : (string) $user->timezone;
            $projects = Project::query()->where('user_id', $user->id)->whereNull('deleted_at')->pluck('name', 'id')->all();
            $context = new NoteContext($clientClock->now(), $zone, $projects, WeekStart::tryFrom((string) $user->week_start) ?? WeekStart::Monday);
            $budgetMs = (float) config('notes.engine_budget_ms');
            $started = hrtime(true);
            $text = $this->splitter->normalize($input['text']);
            $open = [];
            $done = [];
            foreach ($this->splitter->split($text, array_values($projects)) as $item) {
                if ((hrtime(true) - $started) / 1e6 >= $budgetMs) {
                    break;
                }
                $words = $this->matcher->words($item, $context);
                foreach ($this->candidates->find($user->id, $words) as $task) {
                    $open[$task['id']] = $task;
                }
                foreach ($this->candidates->find($user->id, $words, true) as $task) {
                    $done[$task['id']] = $task;
                }
            }
            $remainingMs = max(0.0, $budgetMs - (hrtime(true) - $started) / 1e6);
            $build = $this->engine->build($text, $context, array_values($open), array_values($done), $remainingMs);
            if ($build->plan['dropped'] > 0) {
                Log::info('note_plan_validation', ['dropped' => $build->plan['dropped']]);
            }
            $note = new Note;
            $file = isset($input['source_file_name']) ? basename(str_replace('\\', '/', $input['source_file_name'])) : null;
            $note->forceFill([
                'user_id' => $user->id, 'client_id' => $input['client_id'], 'text' => $text, 'name' => $build->name,
                'status' => $build->status->value, 'engine' => $build->engine->value,
                'source_file_name' => $file === null ? null : preg_replace('/[\p{C}]/u', '', $file),
                'written_at' => $clientClock->now(), 'written_tz' => $zone, 'processed_at' => $this->clock->now(),
                'plan' => $build->plan, 'applied' => [],
            ])->save();
            if ($build->status === PlanStatus::Done) {
                $applied = $this->applier->apply($note, $build->plan, $context);
                $note->applied = $applied['applied'];
                $note->plan = [...$build->plan, 'changes' => $applied['changes'], 'skipped' => $applied['skipped']];
                $note->save();
            }

            return ['note' => $note->refresh(), 'replay' => false];
        }, 3);
    }
}
