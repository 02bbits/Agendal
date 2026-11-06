<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlanStatus;
use App\Enums\WeekStart;
use App\Exceptions\ApiError;
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
use App\Services\Notes\NoteUndo;
use App\Services\Notes\PlanValidator;
use App\Services\Notes\TaskCandidates;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/** @phpstan-import-type ValidatedPlan from PlanValidator */
class ProcessNote
{
    public function __construct(
        private ClockInterface $clock,
        private NoteSplitter $splitter,
        private NoteEngine $engine,
        private CommandMatcher $matcher,
        private TaskCandidates $candidates,
        private NoteApplier $applier,
        private NoteUndo $undo,
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

            return ['note' => $this->process($user, $input), 'replay' => false];
        }, 3);
    }

    /** @param array<string, mixed> $input */
    public function replan(User $user, Note $note, array $input): Note
    {
        return DB::transaction(function () use ($user, $note, $input): Note {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $note = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
            Validator::make($input, [
                'text' => ['required', 'string'],
                'timezone' => ['required', 'string'],
                'confirm_conflicts' => ['sometimes', 'boolean'],
            ])->validate();

            // Notes in done, confirm, followup, kept, pending can be edited (RV §2.5).
            $allowed = [
                PlanStatus::Done->value,
                PlanStatus::Confirm->value,
                PlanStatus::Followup->value,
                'kept',
                'pending',
            ];
            if (! in_array($note->status, $allowed, true)) {
                throw new ApiError('note.wrong_status', 'This note cannot be edited.', 409);
            }

            $text = $this->splitter->normalize($input['text']);
            // Unchanged text and a retry after a lost reply return the already stored result (RV-E18).
            if ($text === $note->text) {
                return $note;
            }

            // RV §2.5: If status is done, undo what the note applied first.
            // RV-E17: older than 30 days throws note.undo_expired.
            // RV-E16: conflicts without confirm_conflicts throws note.undo_conflicts.
            if ($note->status === PlanStatus::Done->value) {
                $confirmConflicts = (bool) ($input['confirm_conflicts'] ?? false);
                $this->undo->reverseApplied($note, $confirmConflicts);
                $note->applied = [];
                $note->undo_log = null;
            } else {
                $note->undo_log = null;
            }

            $input['written_at'] = $this->clock->now()->format(DATE_ATOM);

            return $this->process($user, $input, $note);
        }, 3);
    }

    /** @param array<string, mixed> $input */
    public function replanFollowup(User $user, Note $note, array $input): Note
    {
        return $this->replan($user, $note, $input);
    }

    /** @param array<string, mixed> $input */
    private function process(User $user, array $input, ?Note $note = null): Note
    {
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
        $context = new NoteContext($clientClock->now(), $zone, $projects, WeekStart::tryFrom((string) $user->week_start) ?? WeekStart::Monday, $user->time_format === '12h');
        $budgetMs = (float) config('notes.engine_budget_ms');
        $started = hrtime(true);
        $text = $this->splitter->normalize($input['text']);
        $open = [];
        $done = [];
        foreach ($this->splitter->split($text, array_values($projects)) as $item) {
            if ((hrtime(true) - $started) / 1e6 >= $budgetMs) {
                break;
            }
            $groups = $this->matcher->candidateWords($item, $context);
            foreach ($this->candidates->findEach($user->id, $groups) as $task) {
                $open[$task['id']] = $task;
            }
            foreach ($this->candidates->findEach($user->id, $groups, true) as $task) {
                $done[$task['id']] = $task;
            }
        }
        $remainingMs = max(0.0, $budgetMs - (hrtime(true) - $started) / 1e6);
        $build = $this->engine->build($text, $context, array_values($open), array_values($done), $remainingMs);
        if ($build->plan['dropped'] > 0) {
            Log::info('note_plan_validation', ['dropped' => $build->plan['dropped'], 'at' => 'plan']);
        }
        $note ??= new Note;
        $plan = $note->exists ? [...$build->plan, 'edit_timezone' => $zone] : $build->plan;
        $file = $note->exists ? $note->source_file_name : (isset($input['source_file_name']) ? basename(str_replace('\\', '/', $input['source_file_name'])) : null);
        $note->forceFill([
            'user_id' => $user->id, 'client_id' => $note->exists ? $note->client_id : $input['client_id'], 'text' => $text, 'name' => $build->name,
            'status' => $build->status->value, 'engine' => $build->engine->value,
            'source_file_name' => $file === null ? null : preg_replace('/[\p{C}]/u', '', $file),
            'written_at' => $note->exists ? $note->written_at : $clientClock->now(), 'written_tz' => $note->exists ? $note->written_tz : $zone, 'processed_at' => $this->clock->now(),
            'edited_at' => $note->exists ? $this->clock->now() : null,
            'plan' => $plan, 'applied' => [],
        ])->save();
        if ($build->status === PlanStatus::Done) {
            $applied = $this->applier->apply($note, $plan);
            $note->applied = $applied['applied'];
            $note->plan = [...$plan, 'changes' => $applied['changes'], 'skipped' => $applied['skipped']];
            $note->save();
        } elseif ($build->status === PlanStatus::Confirm) {
            $note->plan = [...$plan, 'changes' => $this->applier->preview($note, $plan)];
            $note->save();
        }

        return $note->refresh();
    }
}
