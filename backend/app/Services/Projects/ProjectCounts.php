<?php

declare(strict_types=1);

namespace App\Services\Projects;

use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Collection;

final class ProjectCounts
{
    /**
     * Set the `open` and `done` task counts on each project using a single grouped query.
     *
     * @param  Collection<array-key, Project>  $projects
     */
    public function load(Collection $projects): void
    {
        if ($projects->isEmpty()) {
            return;
        }

        /** @var \Illuminate\Database\Eloquent\Collection<string, Task> $taskCounts */
        $taskCounts = Task::query()
            ->whereIn('project_id', $projects->pluck('id'))
            ->selectRaw('project_id, count(*) filter (where not done) as open_count, count(*) filter (where done) as done_count')
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        foreach ($projects as $project) {
            /** @var Task|null $counts */
            $counts = $taskCounts->get((string) $project->id);
            $project->setAttribute('open', $counts instanceof Task ? (int) $counts->getAttribute('open_count') : 0);
            $project->setAttribute('done', $counts instanceof Task ? (int) $counts->getAttribute('done_count') : 0);
        }
    }
}
