<?php

it('serves the health check under the API prefix', function () {
    $this->get('/api/v1/health')->assertOk();
});

it('issues the Sanctum CSRF cookie', function () {
    $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN');
});
