<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeliverJobRequest;
use App\Http\Resources\JobResource;
use App\Models\Job;
use App\Services\JobWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeliveryController extends Controller
{
    public function __construct(protected JobWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Job::with(['customer', 'tester', 'technician', 'creator']);

        $status = $request->input('status');
        if ($status && in_array($status, ['ready', 'delivered'])) {
            $query->where('stage', $status);
        } else {
            $query->whereIn('stage', ['ready', 'delivered']);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('token_no', 'like', "%{$search}%")
                  ->orWhere('product_name', 'like', "%{$search}%")
                  ->orWhere('delivery_receiver', 'like', "%{$search}%")
                  ->orWhere('delivery_ref', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%");
                  });
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 100);

        return JobResource::collection($query->latest()->paginate($perPage));
    }

    public function deliver(DeliverJobRequest $request, Job $job): JsonResponse
    {
        $data = $request->validated();
        $sendWhatsApp = $request->boolean('send_whatsapp');
        unset($data['send_whatsapp']);

        $updatedJob = $this->workflow->transition($job, 'deliver', $data, $request->user(), $sendWhatsApp);

        return response()->json([
            'data' => new JobResource($updatedJob),
            'message' => 'Job delivered successfully',
        ], 200);
    }
}
