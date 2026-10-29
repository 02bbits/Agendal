<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
 // ->use(RefreshDatabase::class)
    ->in('Feature');

/*
| Browser-like sessions (IM-10). Feature tests that keep a session across requests use the
| database driver, newRequest() between requests and carryCookies() to pass cookies on.
*/

const SESSION_COOKIE = '__Host-agendal_session';

// The app object lives across test requests, so drop the signed-in user and session it holds,
// as a separate browser request would
function newRequest(): void
{
    Auth::forgetGuards();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
}

// The test client doesn't keep cookies between requests, so carry them like a browser would
function carryCookies(TestResponse $response): array
{
    return collect($response->headers->getCookies())
        ->mapWithKeys(fn ($c) => [$c->getName() => $response->getCookie($c->getName(), $c->getName() !== 'XSRF-TOKEN')->getValue()])
        ->all();
}

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}
