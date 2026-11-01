<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;

/** The user's tasks that share a meaningful word with a command, by trigram relevance (NU §2.4). */
final class TaskCandidates
{
    /** A title's words, space-padded, the way NoteVocabulary::tokens() splits them: composed, unaccented, lower-cased. */
    private const TOKENS = "' ' || regexp_replace(lower(immutable_unaccent(normalize(title, NFC))), '[^[:alnum:]]+', ' ', 'g') || ' '";

    /**
     * Candidates for each group of words (CommandMatcher::candidateWords), so every task a command names has its own
     * share: "move report and gym to friday" finds Gym among many Reports.
     *
     * @param  list<list<string>>  $groups
     * @return list<array<string, mixed>>
     */
    public function findEach(int $userId, array $groups, bool $done = false): array
    {
        $byId = [];
        foreach ($groups as $words) {
            foreach ($this->find($userId, $words, $done) as $row) {
                $byId[(string) $row['id']] ??= $row;
            }
        }

        return array_values($byId);
    }

    /**
     * @param  list<string>  $words
     * @return list<array<string, mixed>>
     */
    public function find(int $userId, array $words, bool $done = false): array
    {
        if ($words === []) {
            return [];
        }
        $query = Task::query()->where('user_id', $userId)->where('done', $done)->whereNull('deleted_at');
        $likes = array_map(fn (string $word): string => '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $word).'%', $words);
        $query->where(function (Builder $query) use ($words, $likes): void {
            foreach ($words as $index => $word) {
                $query->orWhereRaw("(immutable_unaccent(title) % immutable_unaccent(?) OR immutable_unaccent(title) ILIKE immutable_unaccent(?) ESCAPE '!')", [$word, $likes[$index]]);
            }
        });
        // Titles holding more of the command's words first, read as NoteVocabulary::tokens() reads them, so "Annual
        // sales report" beats 55 "Report n", "Buy a red pen" beats "Buyer red pencil n" and "Send_invoice" counts both
        // words. Words are letters and digits only, so they hold no LIKE wildcards.
        $found = implode(' + ', array_fill(0, count($words), '(('.self::TOKENS.") LIKE '% ' || lower(immutable_unaccent(?)) || ' %')::int"));
        $rank = implode(', ', array_fill(0, count($words), 'similarity(immutable_unaccent(title), immutable_unaccent(?))'));

        return array_values($query->orderByRaw('('.$found.') DESC', $words)->orderByRaw('greatest('.$rank.') DESC', $words)->orderBy('id')->limit((int) config('notes.match_candidates'))->get()
            ->map(function (Task $task): array {
                $row = $task->getAttributes();
                foreach (['start_time', 'end_time'] as $key) {
                    $row[$key] = isset($row[$key]) ? substr($row[$key], 0, 5) : null;
                }
                $row['done'] = (bool) $row['done'];

                return $row;
            })->all());
    }
}
