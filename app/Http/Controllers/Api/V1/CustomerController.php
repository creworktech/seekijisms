<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerStoreRequest;
use App\Http\Requests\CustomerUpdateRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\JobResource;
use App\Models\Customer;
use App\Services\CounterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class CustomerController extends Controller
{
    public function __construct(protected CounterService $counterService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Customer::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('mobile', 'like', "%{$search}%")
                  ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            if ($status === 'active') {
                $query->where('is_active', true);
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            }
        }

        $sort = $request->input('sort', '-created_at');
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        if (in_array($column, ['id', 'name', 'customer_code', 'registered_on', 'created_at'])) {
            $query->orderBy($column, $direction);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = min((int) $request->input('per_page', 30), 100);

        return CustomerResource::collection($query->paginate($perPage));
    }

    public function store(CustomerStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['customer_code'] = $this->counterService->nextCustomerCode();
        $data['registered_on'] = $data['registered_on'] ?? Carbon::today()->format('Y-m-d');
        $data['created_by'] = $request->user()?->id;

        $customer = Customer::create($data);

        return response()->json([
            'data' => new CustomerResource($customer),
            'message' => 'Customer created successfully',
        ], 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json([
            'data' => new CustomerResource($customer),
        ], 200);
    }

    public function update(CustomerUpdateRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return response()->json([
            'data' => new CustomerResource($customer->fresh()),
            'message' => 'Customer updated successfully',
        ], 200);
    }

    public function toggleStatus(Customer $customer): JsonResponse
    {
        $customer->update(['is_active' => ! $customer->is_active]);
        $statusMsg = $customer->is_active ? 'Customer added to Dashboard.' : 'Customer removed from Dashboard.';

        return response()->json([
            'data' => new CustomerResource($customer->fresh()),
            'message' => $statusMsg,
        ], 200);
    }

    public function jobs(Customer $customer): AnonymousResourceCollection
    {
        $jobs = $customer->jobs()->with(['tester', 'technician', 'creator'])->latest()->paginate(100);
        return JobResource::collection($jobs);
    }

    public function checkMobile(Request $request): JsonResponse
    {
        $mobile = $request->input('mobile');
        if (! $mobile) {
            return response()->json(['available' => true, 'existing_customer' => null], 200);
        }

        $customer = Customer::where('mobile', $mobile)->first();

        if ($customer) {
            return response()->json([
                'available' => false,
                'existing_customer' => [
                    'id' => $customer->id,
                    'customer_code' => $customer->customer_code,
                    'name' => $customer->name,
                ],
            ], 200);
        }

        return response()->json([
            'available' => true,
            'existing_customer' => null,
        ], 200);
    }
}
