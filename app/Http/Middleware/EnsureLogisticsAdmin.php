<?php

namespace App\Http\Middleware;

use App\Models\LogisticsUser;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the logistics admin surface.
 *
 * Only a Service Management System web user holding users.manage may pass.
 * Logistics accounts are mobile field staff — they never administer the
 * system, so a LogisticsUser is always refused here even though the route
 * lets them authenticate (which keeps the refusal a clear 403, not a 401).
 */
class EnsureLogisticsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->is_active && $user->can('users.manage')) {
            return $next($request);
        }

        abort(403, 'This action requires logistics administrator access.');
    }
}
