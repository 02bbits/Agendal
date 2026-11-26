<?php

namespace App\Support;

use App\Models\User;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\Operation;
use Dedoc\Scramble\Support\Generator\Reference;
use Dedoc\Scramble\Support\Generator\Response;
use Dedoc\Scramble\Support\Generator\Schema;
use Dedoc\Scramble\Support\Generator\SecurityRequirement;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Dedoc\Scramble\Support\Generator\Server;
use Dedoc\Scramble\Support\Generator\Types\ArrayType;
use Dedoc\Scramble\Support\Generator\Types\IntegerType;
use Dedoc\Scramble\Support\Generator\Types\ObjectType;
use Dedoc\Scramble\Support\Generator\Types\StringType;
use Dedoc\Scramble\Support\RouteInfo;
use Illuminate\Support\Facades\Gate;

// IM-08: the generated API docs (/docs/api). Scramble infers routes, requests and resources; this
// adds what it can't see: the cookie session with its CSRF header, Bearer tokens, and the one error shape
class ApiDocs
{
    public static function register(): void
    {
        // Outside local, the same signed-in accounts as /telescope and /pulse (TELESCOPE_ALLOWED_EMAILS)
        Gate::define('viewApiDocs', fn (?User $user) => $user !== null
            && in_array($user->email, config('telescope.allowed_emails'), true));

        Scramble::configure()
            ->withOperationTransformers(function (Operation $operation, RouteInfo $route): void {
                $schemes = array_merge(
                    in_array('auth:sanctum', $route->route->gatherMiddleware(), true) ? ['session' => []] : [],
                    // Sanctum checks CSRF on every stateful write, signed in or not
                    in_array($operation->method, ['get', 'head'], true) ? [] : ['csrf' => []],
                );
                $operation->security = $schemes === [] ? [] : [new SecurityRequirement($schemes)];
                // Data routes also take a personal access token with the route's abilities (#196)
                $abilities = collect($route->route->gatherMiddleware())->first(fn ($m) => is_string($m) && str_starts_with($m, 'abilities:'));
                if (is_string($abilities)) {
                    $operation->security[] = new SecurityRequirement(['token' => []]);
                    $needs = str_replace(',', '`, `', substr($abilities, strlen('abilities:')));
                    $operation->description = trim("Token abilities: `{$needs}`.\n\n".$operation->description);
                }

                // Scramble documents Laravel's own error body; bootstrap/app.php renders ours
                $error = Schema::fromType(Reference::fromUri('#/components/schemas/ApiError'));
                foreach ($operation->responses ?? [] as $i => $response) {
                    $response = $response instanceof Reference ? $response->resolve() : $response;
                    if ($response instanceof Response && (int) $response->code >= 400) {
                        $operation->responses[$i] = Response::make((int) $response->code)->setDescription($response->description)->setContent('application/json', $error);
                    }
                }
                // Every route sits behind a rate limit (NF-13)
                $operation->addResponse(Response::make(429)->setDescription('Rate limited. `Retry-After` header; `error.limit` names the limit.')->setContent('application/json', $error));
            })
            ->withDocumentTransformers(function (OpenApi $openApi): void {
                // Relative, so Try it calls the origin the page was opened on (:3000 through Next.js, or
                // :8000) and keeps its session cookie; an absolute APP_URL would be cross-origin
                $openApi->servers = [Server::make('/api/v1')];
                // Only the exception responses replaced above lived here
                $openApi->components->responses = [];
                $openApi->components->addSecurityScheme('session', SecurityScheme::apiKey('cookie', (string) config('session.cookie'))
                    ->setDescription('Sanctum cookie session (ADR-007): `GET /sanctum/csrf-cookie`, then `POST /auth/login`.'));
                $openApi->components->addSecurityScheme('csrf', SecurityScheme::apiKey('header', 'X-XSRF-TOKEN')
                    ->setDescription('The `XSRF-TOKEN` cookie\'s value, on every write. A browser request from the same origin may leave it out: Laravel accepts its `Sec-Fetch-Site: same-origin`.'));
                $openApi->components->addSecurityScheme('token', SecurityScheme::http('bearer')
                    ->setDescription('A personal access token from `POST /tokens` (#196), for scripts. Reaches the data routes its abilities allow. On this page a signed-in session is sent too and wins, so test a token with curl.'));
                $openApi->components->addSchema('ApiError', Schema::fromType(self::errorType()));
            });
    }

    // Mirrors docs/07-architecture/contracts/schemas/error.schema.json
    private static function errorType(): ObjectType
    {
        $strings = (new ArrayType)->setItems(new StringType);
        $error = (new ObjectType)
            ->addProperty('code', (new StringType)->setDescription('A copy-catalog key, e.g. `error.not_found`.'))
            ->addProperty('message', new StringType)
            ->addProperty('request_id', new StringType)
            ->addProperty('fields', (new ObjectType)->additionalProperties($strings)->setDescription('422: messages per request field.'))
            ->addProperty('retry_after', (new IntegerType)->setDescription('429: seconds before the next try.'))
            ->addProperty('limit', (new ObjectType)
                ->addProperty('max', new IntegerType)
                ->addProperty('window', new IntegerType)
                ->setRequired(['max', 'window'])
                ->setDescription('429: `max` requests per `window` seconds; a 1-second window is a burst.'))
            ->addProperty('tasks', (new ArrayType)
                ->setItems((new ObjectType)->addProperty('id', (new StringType)->format('uuid'))->addProperty('title', new StringType)->setRequired(['id', 'title']))
                ->setDescription('409 `note.undo_conflicts`: the conflicting tasks.'))
            ->setRequired(['code', 'message']);

        return (new ObjectType)->addProperty('error', $error)->setRequired(['error']);
    }
}
