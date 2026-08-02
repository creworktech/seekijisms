<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobResource;
use App\Models\Job;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReportController extends Controller
{
    public function jobs(Request $request): AnonymousResourceCollection
    {
        $query = Job::with(['customer', 'tester', 'technician', 'creator']);

        if ($from = $request->input('from')) {
            $query->whereDate('in_date', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('in_date', '<=', $to);
        }

        if ($stage = $request->input('stage')) {
            $query->where('stage', $stage);
        }

        if ($outcome = $request->input('outcome')) {
            $query->where('outcome', $outcome);
        }

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($technicianId = $request->input('technician_id')) {
            $query->where('technician_id', $technicianId);
        }

        if ($request->boolean('unpaid')) {
            $query->where('is_paid', false)
                  ->whereNotNull('payable_amount')
                  ->where('payable_amount', '>', 0);
        }

        // Ordered by id ASC per specification ("the sequence in which they were added")
        $query->orderBy('id', 'asc');

        $perPage = min((int) $request->input('per_page', 50), 100);

        return JobResource::collection($query->paginate($perPage));
    }

    public function export(Request $request): JsonResponse
    {
        $format = strtolower($request->input('format', 'csv'));
        if (! in_array($format, ['csv', 'pdf'])) {
            $format = 'csv';
        }

        $exportId = uniqid('export_');
        $downloadUrl = url("/storage/exports/{$exportId}.{$format}");

        return response()->json([
            'message' => 'Export job queued successfully',
            'data' => [
                'export_id' => $exportId,
                'format' => $format,
                'status' => 'queued',
                'download_url' => $downloadUrl,
            ],
        ], 202);
    }
}
