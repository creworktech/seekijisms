<?php

namespace Tests\Feature\Logistics;

use Illuminate\Testing\TestResponse;

/**
 * Base for admin-surface tests. Acts as the logistics admin and keeps the
 * long /admin URL prefix out of every assertion.
 */
abstract class LogisticsAdminTestCase extends LogisticsTestCase
{
    protected function adminUrl(string $path): string
    {
        return $this->apiUrl('admin/' . ltrim($path, '/'));
    }

    /**
     * Administration is a web-session concern: a Service Management System
     * user holding users.manage. No logistics account can reach these routes.
     *
     * @return $this
     */
    protected function adminRequest(): static
    {
        return $this->actingAs($this->webAdmin(), 'web');
    }
}
