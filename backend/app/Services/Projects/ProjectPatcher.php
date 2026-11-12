<?php

declare(strict_types=1);

namespace App\Services\Projects;

use App\Exceptions\ApiError;
use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Services\Tasks\TaskPatcher;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Last write wins per project field (ADR-004, PJ §8): name, colour and deleted. A sync patch
 * passes its `at`; the REST endpoints pass null, the server's own "now".
 */
final class ProjectPatcher
{
    public function __construct(
        // Its clamp and stamp comparison are the tasks' (SC-17)
        private readonly TaskPatcher $lww,
        private readonly ProjectDeleter $deleter,
    ) {}

    /**
     * Applies one field. False when the stored stamp is later (stale).
     *
     * @throws ValidationException|ApiError when the value isn't valid
     */
    public function patch(Project $project, string $field, mixed $value, ?string $at): bool
    {
        $effective = $this->lww->resolveEffectiveAt($at);
        if (! $this->lww->isLaterThan($effective, $project->field_updated_at[$field] ?? null)) {
            return false;
        }

        if ($field === 'deleted') {
            $this->setDeleted($project, $value);
        } else {
            $value = is_string($value) ? trim($value) : $value;
            Validator::make([$field => $value], [
                $field => ['required', ...($field === 'name' ? StoreProjectRequest::nameRules() : StoreProjectRequest::colourRules())],
            ])->validate();
            if ($field === 'name') {
                self::ensureNameAvailable((string) $value, (string) $project->id);
            }
            $project->setAttribute($field, $value);
        }

        $this->stamp($project, [$field], $effective->format('Y-m-d\TH:i:s\Z'));
        $project->save();

        return true;
    }

    /** @param list<string> $fields */
    public function stamp(Project $project, array $fields, string $at): void
    {
        $stamps = $project->field_updated_at ?? [];
        foreach ($fields as $field) {
            $stamps[$field] = $at;
        }
        $project->field_updated_at = $stamps;
    }

    /** `deleted`: "move" or "delete" names what happens to its tasks (as the delete dialog); false restores. */
    private function setDeleted(Project $project, mixed $value): void
    {
        if ($value === false) {
            if ($project->deleted_at !== null) {
                self::ensureNameAvailable((string) $project->name, (string) $project->id);
                $this->deleter->restore($project, [], 'move');
            }

            return;
        }
        if (! in_array($value, ['move', 'delete'], true)) {
            throw ValidationException::withMessages(['deleted' => ['Use "move", "delete" or false.']]);
        }
        if ($project->deleted_at === null) {
            $this->deleter->delete($project, $value);
        }
    }

    public static function ensureNameAvailable(string $name, ?string $ignoreProjectId = null): void
    {
        $query = Project::query()
            ->whereNull('deleted_at')
            ->whereRaw('lower(name) = lower(?)', [$name]);

        if ($ignoreProjectId !== null) {
            $query->whereKeyNot($ignoreProjectId);
        }

        $existingWithName = $query->first();

        if ($existingWithName) {
            $message = "You already have a project called “{$existingWithName->name}”.";
            throw new ApiError('project.name_taken', $message, 422, ['name' => [$message]]);
        }
    }
}
