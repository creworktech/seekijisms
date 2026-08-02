<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobResource;
use App\Models\Job;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $today = Carbon::today();

        $todayReceived = Job::whereDate('created_at', $today)->count();

        $totalRevenue = (float) Job::where('is_paid', true)->sum('payable_amount');
        $duesAmount = (float) Job::where('is_paid', false)
            ->whereNotNull('payable_amount')
            ->sum('payable_amount');

        $cancelledJobs = Job::where('outcome', 'cancelled')->count();

        $rawStages = DB::table('jobs')
            ->whereNull('deleted_at')
            ->selectRaw('stage, count(*) as count')
            ->groupBy('stage')
            ->pluck('count', 'stage')
            ->all();

        $allStages = [
            'new' => 0, 'testing' => 0, 'approval' => 0, 'repair' => 0,
            'pending' => 0, 'completed' => 0, 'ready' => 0, 'delivered' => 0,
        ];
        foreach ($allStages as $stageKey => $default) {
            $allStages[$stageKey] = (int) ($rawStages[$stageKey] ?? 0);
        }

        $rawOutcomes = DB::table('jobs')
            ->whereNull('deleted_at')
            ->whereNotNull('outcome')
            ->selectRaw('outcome, count(*) as count')
            ->groupBy('outcome')
            ->pluck('count', 'outcome')
            ->all();

        $highPriorityCount = Job::where('priority', 'high')
            ->where('stage', '!=', 'delivered')
            ->count();

        return response()->json([
            'data' => [
                'tiles' => [
                    'today_received' => $todayReceived,
                    'total_revenue' => $totalRevenue,
                    'dues_amount' => $duesAmount,
                    'cancelled_jobs' => $cancelledJobs,
                ],
                'stages' => $allStages,
                'outcomes' => $rawOutcomes,
                'high_priority' => $highPriorityCount,
            ],
        ], 200);
    }

    public function recentJobs(Request $request): JsonResponse
    {
        $limit = min((int) $request->input('limit', 5), 20);

        $jobs = Job::with(['customer', 'technician', 'tester'])
            ->orderBy('id', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => JobResource::collection($jobs),
        ], 200);
    }
}
