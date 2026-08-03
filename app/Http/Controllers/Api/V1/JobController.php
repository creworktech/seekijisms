<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\JobCreated;
use App\Http\Controllers\Controller;
use App\Http\Requests\JobCreateRequest;
use App\Http\Requests\JobStoreRequest;
use App\Http\Requests\JobTransitionRequest;
use App\Http\Requests\JobUpdateRequest;
use App\Http\Resources\JobEventResource;
use App\Http\Resources\JobResource;
use App\Models\Job;
use App\Services\CounterService;
use App\Services\JobWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class JobController extends Controller
{
    public function __construct(
        protected CounterService $counterService,
        protected JobWorkflow $workflow
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Job::with(['customer', 'tester', 'technician', 'creator']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('token_no', 'like', "%{$search}%")
                  ->orWhere('product_name', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%")
                  ->orWhere('serial_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%")
                        ->orWhere('customer_code', 'like', "%{$search}%");
                  });
            });
        }

        if ($stage = $request->input('stage')) {
            $query->where('stage', $stage);
        }

        if ($outcome = $request->input('outcome')) {
            $query->where('outcome', $outcome);
        }

        if ($priority = $request->input('priority')) {
            $query->where('priority', $priority);
        }

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($technicianId = $request->input('technician_id')) {
            $query->where('technician_id', $technicianId);
        }

        if ($from = $request->input('from')) {
            $query->whereDate('in_date', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('in_date', '<=', $to);
        }

        if ($request->boolean('unpaid')) {
            $query->where('is_paid', false)
                  ->whereNotNull('payable_amount')
                  ->where('payable_amount', '>', 0);
        }

        $sort = $request->input('sort', '-created_at');
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        if (in_array($column, ['id', 'token_no', 'in_date', 'stage', 'priority', 'created_at'])) {
            $query->orderBy($column, $direction);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = min((int) $request->input('per_page', 30), 100);

        return JobResource::collection($query->paginate($perPage));
    }

    public function store(JobStoreRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            $productsInput = $request->input('products');
            $creatorId = $request->user()?->id ?? \Illuminate\Support\Facades\Auth::id() ?? \App\Models\User::value('id') ?? 1;

            $rawInDate = $request->input('in_date');
            $globalInDate = (!empty($rawInDate) && is_string($rawInDate)) ? $rawInDate : Carbon::today()->format('Y-m-d');

            // Check if multiple products submitted in single intake
            if (is_array($productsInput) && count($productsInput) > 0) {
                $customerId = $data['customer_id'];
                $globalReceivedFrom = in_array($request->input('received_from'), ['self', 'courier', 'bus']) ? $request->input('received_from') : 'self';
                $globalPriority = in_array($request->input('priority'), ['high', 'medium', 'low']) ? $request->input('priority') : 'medium';

                $createdJobs = DB::transaction(function () use ($productsInput, $customerId, $globalReceivedFrom, $globalPriority, $globalInDate, $creatorId) {
                    $jobs = [];
                    foreach ($productsInput as $prodData) {
                        $recFrom = in_array($prodData['received_from'] ?? '', ['self', 'courier', 'bus']) ? $prodData['received_from'] : $globalReceivedFrom;
                        $prio = in_array($prodData['priority'] ?? '', ['high', 'medium', 'low']) ? $prodData['priority'] : $globalPriority;

                        $jobData = [
                            'customer_id' => $customerId,
                            'token_no' => $this->counterService->nextJobToken(),
                            'product_name' => !empty($prodData['product_name']) ? $prodData['product_name'] : 'Serviced Product',
                            'brand' => !empty($prodData['brand']) ? $prodData['brand'] : null,
                            'serial_no' => !empty($prodData['serial_no']) ? $prodData['serial_no'] : null,
                            'power_rating' => !empty($prodData['power_rating']) ? $prodData['power_rating'] : null,
                            'fault_description' => !empty($prodData['fault_description']) ? $prodData['fault_description'] : 'Initial inspection requested',
                            'customer_remark' => !empty($prodData['customer_remark']) ? $prodData['customer_remark'] : null,
                            'received_from' => $recFrom,
                            'priority' => $prio,
                            'stage' => 'new',
                            'in_date' => $globalInDate,
                            'created_by' => $creatorId,
                        ];

                        $job = Job::create($jobData);
                        event(new JobCreated($job));
                        $jobs[] = $job->load(['customer', 'creator']);
                    }
                    return $jobs;
                });

                $tokensArr = array_map(fn($j) => '#' . $j->token_no, $createdJobs);
                $tokensStr = implode(', ', $tokensArr);
                $count = count($createdJobs);

                return response()->json([
                    'data' => JobResource::collection($createdJobs),
                    'count' => $count,
                    'tokens' => array_map(fn($j) => $j->token_no, $createdJobs),
                    'message' => "{$count} Work Orders created successfully ({$tokensStr})",
                ], 201);
            }

            // Single product fallback
            $data['token_no'] = $this->counterService->nextJobToken();
            $data['stage'] = 'new';
            $data['priority'] = in_array($data['priority'] ?? '', ['high', 'medium', 'low']) ? $data['priority'] : 'medium';
            $data['received_from'] = in_array($data['received_from'] ?? '', ['self', 'courier', 'bus']) ? $data['received_from'] : 'self';
            $data['in_date'] = $globalInDate;
            $data['created_by'] = $creatorId;
            $data['fault_description'] = !empty($data['fault_description']) ? $data['fault_description'] : 'Initial inspection requested';

            $job = Job::create($data);
            event(new JobCreated($job));

            return response()->json([
                'data' => new JobResource($job->load(['customer', 'creator'])),
                'message' => "Work Order #{$job->token_no} created successfully",
            ], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to create job: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function show(Job $job): JsonResponse
    {
        $job->load(['customer', 'tester', 'technician', 'creator']);

        return response()->json([
            'data' => new JobResource($job),
        ], 200);
    }

    public function update(JobUpdateRequest $request, Job $job): JsonResponse
    {
        $job->update($request->validated());

        return response()->json([
            'data' => new JobResource($job->fresh(['customer', 'tester', 'technician', 'creator'])),
            'message' => 'Job updated successfully',
        ], 200);
    }

    public function events(Job $job): AnonymousResourceCollection
    {
        return JobEventResource::collection($job->events()->with('user')->get());
    }

    public function transition(JobTransitionRequest $request, Job $job): JsonResponse
    {
        $action = $request->input('action');
        $sendWhatsApp = $request->boolean('send_whatsapp');
        $data = $request->validated();
        unset($data['action'], $data['send_whatsapp']);

        $updatedJob = $this->workflow->transition($job, $action, $data, $request->user(), $sendWhatsApp);

        $userMessage = $this->getActionSuccessMessage($action, $updatedJob);

        return response()->json([
            'data' => new JobResource($updatedJob),
            'message' => $userMessage,
        ], 200);
    }

    public function destroy(Request $request, Job $job): JsonResponse
    {
        if (! $request->user()?->hasRole('admin')) {
            return response()->json([
                'message' => 'Unauthorized. Only admins can delete work orders.',
            ], 403);
        }

        $tokenNo = $job->token_no;
        $job->delete();

        return response()->json([
            'message' => "Work Order #{$tokenNo} deleted successfully.",
        ], 200);
    }

    protected function getActionSuccessMessage(string $action, Job $job): string
    {
        return match ($action) {
            'assign_tester' => "Job #{$job->token_no} assigned to tester successfully.",
            'fault_found' => "Job #{$job->token_no} tested: fault found and sent for budget approval.",
            'ok_no_fault' => "Job #{$job->token_no} tested: no fault found, moved to completion.",
            'not_repairable' => "Job #{$job->token_no} marked as not repairable.",
            'approve' => "Estimate approved and Job #{$job->token_no} assigned to technician for repair.",
            'not_approved' => "Estimate rejected by customer for Job #{$job->token_no}.",
            'reassign_technician' => "Job #{$job->token_no} reassigned to technician successfully.",
            'work_done' => "Repair work completed for Job #{$job->token_no}.",
            'mark_pending' => "Job #{$job->token_no} marked as pending (work paused).",
            'move_to_work' => "Job #{$job->token_no} resumed from pending state.",
            'collect_payment' => "Payment collected for Job #{$job->token_no}, ready for delivery.",
            'release_unpaid' => "Job #{$job->token_no} released for delivery.",
            'deliver' => "Job #{$job->token_no} delivered successfully.",
            'cancel' => "Job #{$job->token_no} cancelled successfully.",
            default => "Job #{$job->token_no} updated successfully.",
        };
    }
}
