<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\JobResource;
use App\Http\Resources\UserResource;
use App\Models\Customer;
use App\Models\Job;
use App\Models\Setting;
use App\Models\User;
use App\Services\CounterService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class WebController extends Controller
{
    public function __construct(
        protected CounterService $counterService
    ) {}

    public function loginForm(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/Login');
    }

    public function login(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated. Contact admin.'],
            ]);
        }

        Auth::login($user, $request->boolean('remember'));
        $user->update(['last_login_at' => now()]);
        $request->session()->regenerate();

        // Generate sanctum token for frontend API calls
        $token = $user->createToken('auth-token')->plainTextToken;
        session(['sanctum_token' => $token]);

        return redirect()->intended(route('dashboard'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    public function dashboard(): Response
    {
        $overallStats = $this->calculateJobStats();

        $dashboardCustomers = Customer::where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function ($c) {
                $cStats = $this->calculateJobStats(Job::where('customer_id', $c->id));
                $email = strtolower(str_replace(' ', '.', trim($c->name))) . '@email.com';
                return [
                    'id' => $c->id,
                    'customer_code' => $c->customer_code,
                    'name' => $c->name,
                    'email' => $email,
                    'mobile' => $c->mobile,
                    'address' => $c->address,
                    'is_active' => (bool) $c->is_active,
                    'registered_on' => $c->registered_on?->format('M d, Y') ?? $c->created_at?->format('M d, Y'),
                    'stats' => $cStats,
                ];
            });

        $recentJobs = Job::with(['customer', 'technician', 'tester'])
            ->orderBy('id', 'desc')
            ->limit(5)
            ->get();

        return Inertia::render('Dashboard/Index', [
            'stats' => $overallStats,
            'dashboardCustomers' => $dashboardCustomers,
            'recentJobs' => JobResource::collection($recentJobs)->resolve(),
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    private function calculateJobStats($query = null): array
    {
        $today = Carbon::today();
        $baseQuery = $query ? clone $query : Job::query();

        $totalReceived = (clone $baseQuery)->count();
        $todayReceived = (clone $baseQuery)->whereDate('created_at', $today)->count();
        $todaysTask    = (clone $baseQuery)->where('stage', 'repair')->count();

        $totalRevenue = (float) (clone $baseQuery)->where('is_paid', true)->sum('payable_amount');
        $duesAmount   = (float) (clone $baseQuery)->where('is_paid', false)
            ->whereNotNull('payable_amount')
            ->sum('payable_amount');
        $cancelledJobs = (clone $baseQuery)->where('outcome', 'cancelled')->count();

        $rawStages = (clone $baseQuery)
            ->selectRaw('stage, count(*) as count')
            ->groupBy('stage')
            ->pluck('count', 'stage')
            ->all();

        $newJobs       = (int) ($rawStages['new'] ?? 0);
        $testing       = (int) ($rawStages['testing'] ?? 0);
        $underTesting  = (int) ($rawStages['testing'] ?? 0);
        $approval      = (int) ($rawStages['approval'] ?? 0);
        $repair        = (int) ($rawStages['repair'] ?? 0);
        $pending       = (int) ($rawStages['pending'] ?? 0);
        $completed     = (int) ($rawStages['completed'] ?? 0);
        $ready         = (int) ($rawStages['ready'] ?? 0);
        $delivered     = (int) ($rawStages['delivered'] ?? 0);

        $rawOutcomes = (clone $baseQuery)
            ->whereNotNull('outcome')
            ->selectRaw('outcome, count(*) as count')
            ->groupBy('outcome')
            ->pluck('count', 'outcome')
            ->all();

        $notRepairable = (int) ($rawOutcomes['not_repairable'] ?? 0);
        $cancelled     = (int) ($rawOutcomes['cancelled'] ?? 0);

        $highPriorityCount = (clone $baseQuery)->where('priority', 'high')
            ->where('stage', '!=', 'delivered')
            ->where(function ($q) {
                $q->whereNull('outcome')->orWhere('outcome', '!=', 'cancelled');
            })
            ->count();

        return [
            'tiles' => [
                'new_jobs' => $newJobs,
                'today_received' => $todayReceived,
                'total_revenue' => $totalRevenue,
                'dues_amount' => $duesAmount,
                'cancelled_jobs' => $cancelledJobs,
            ],
            'total_received' => $totalReceived,
            'today_received' => $todayReceived,
            'new_jobs' => $newJobs,
            'testing' => $testing,
            'under_testing' => $underTesting,
            'todays_task' => $todaysTask,
            'approval' => $approval,
            'delivered' => $delivered,
            'ready' => $ready,
            'pending' => $pending,
            'not_repairable' => $notRepairable,
            'cancelled' => $cancelled,
            'completed' => $completed,
            'high_priority' => $highPriorityCount,
            'stages' => [
                'new' => $newJobs,
                'testing' => $testing,
                'approval' => $approval,
                'repair' => $repair,
                'pending' => $pending,
                'completed' => $completed,
                'ready' => $ready,
                'delivered' => $delivered,
            ],
            'outcomes' => $rawOutcomes,
            'high_priority_count' => $highPriorityCount,
        ];
    }

    public function customers(Request $request): Response
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

        $customers = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 30))
            ->withQueryString();

        return Inertia::render('Customers/Index', [
            'customers' => CustomerResource::collection($customers)->response()->getData(true),
            'filters' => $request->only(['search', 'status']),
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function jcc(Request $request): Response
    {
        if (! $request->user()?->hasRole('admin')) {
            abort(403, 'Unauthorized access to Job Control Center.');
        }

        $query = Job::with(['customer', 'tester', 'technician', 'creator', 'events.user']);

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

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $stage = $request->input('stage');
        if (! $stage) {
            $stage = 'new';
        }
        $query->where('stage', $stage);

        $jobs = $query->orderBy('id', 'desc')->get();

        $customers = Customer::orderBy('name', 'asc')->get(['id', 'name', 'customer_code', 'mobile']);

        $testers = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'tester']))
            ->get(['id', 'name', 'email'])
            ->sortBy(function ($user) {
                return ($user->hasRole('admin') || str_contains(strtolower($user->name), 'admin')) ? 1 : 0;
            })->values();

        $technicians = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'technician']))
            ->get(['id', 'name', 'email'])
            ->sortBy(function ($user) {
                return ($user->hasRole('admin') || str_contains(strtolower($user->name), 'admin')) ? 1 : 0;
            })->values();

        $prefix = Setting::get('token_prefix', 'SES');
        $previewToken = $prefix . '1, ' . $prefix . '2...';

        $stageCountsRaw = DB::table('jobs')
            ->whereNull('deleted_at')
            ->when($customerId, fn ($q) => $q->where('customer_id', $customerId))
            ->selectRaw('stage, count(*) as count')
            ->groupBy('stage')
            ->pluck('count', 'stage')
            ->all();

        $stageCounts = [
            'new' => (int) ($stageCountsRaw['new'] ?? 0),
            'testing' => (int) ($stageCountsRaw['testing'] ?? 0),
            'approval' => (int) ($stageCountsRaw['approval'] ?? 0),
            'repair' => (int) ($stageCountsRaw['repair'] ?? 0),
            'pending' => (int) ($stageCountsRaw['pending'] ?? 0),
            'completed' => (int) ($stageCountsRaw['completed'] ?? 0),
            'ready' => (int) ($stageCountsRaw['ready'] ?? 0),
            'delivered' => (int) ($stageCountsRaw['delivered'] ?? 0),
        ];

        return Inertia::render('Jobs/ControlCenter', [
            'jobs' => JobResource::collection($jobs)->resolve(),
            'customers' => $customers,
            'stageCounts' => $stageCounts,
            'testers' => $testers,
            'technicians' => $technicians,
            'tokenPreview' => $previewToken,
            'filters' => array_merge($request->only(['search', 'customer_id']), ['stage' => $stage]),
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function jobs(Request $request): Response
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

        if ($outcomeGroup = $request->input('outcome_group')) {
            if ($outcomeGroup === 'new_jobs') {
                $query->where('stage', 'new');
            } elseif ($outcomeGroup === 'in_progress') {
                $query->whereIn('stage', ['testing', 'approval', 'repair'])->whereNull('outcome');
            } elseif ($outcomeGroup === 'pending') {
                $query->where('stage', 'pending');
            } elseif ($outcomeGroup === 'repaired') {
                $query->whereIn('outcome', ['work_done', 'ok_no_fault']);
            } elseif ($outcomeGroup === 'not_approved') {
                $query->where('outcome', 'not_approved');
            } elseif ($outcomeGroup === 'not_repairable') {
                $query->where('outcome', 'not_repairable');
            } elseif ($outcomeGroup === 'cancelled') {
                $query->where('outcome', 'cancelled');
            } elseif ($outcomeGroup === 'ready') {
                $query->where('stage', 'ready');
            } elseif ($outcomeGroup === 'delivered') {
                $query->where('stage', 'delivered');
            }
        }

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
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

        $jobs = $query->orderBy('id', 'desc')
            ->paginate($request->input('per_page', 30))
            ->withQueryString();

        $customers = Customer::orderBy('name', 'asc')->get(['id', 'name', 'customer_code', 'mobile']);

        $testers = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'tester']))
            ->get(['id', 'name', 'email']);

        $technicians = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'technician']))
            ->get(['id', 'name', 'email']);

        $prefix = Setting::get('token_prefix', 'SES');
        $previewToken = $prefix . '1, ' . $prefix . '2...';

        $countQuery = Job::query()->when($customerId, fn ($q) => $q->where('customer_id', $customerId));

        $totalJobsCount = (clone $countQuery)->count();

        $outcomeGroupCounts = [
            'new_jobs' => (clone $countQuery)->where('stage', 'new')->count(),
            'in_progress' => (clone $countQuery)->whereIn('stage', ['testing', 'approval', 'repair'])->whereNull('outcome')->count(),
            'pending' => (clone $countQuery)->where('stage', 'pending')->count(),
            'repaired' => (clone $countQuery)->whereIn('outcome', ['work_done', 'ok_no_fault'])->count(),
            'not_approved' => (clone $countQuery)->where('outcome', 'not_approved')->count(),
            'not_repairable' => (clone $countQuery)->where('outcome', 'not_repairable')->count(),
            'cancelled' => (clone $countQuery)->where('outcome', 'cancelled')->count(),
            'ready' => (clone $countQuery)->where('stage', 'ready')->count(),
            'delivered' => (clone $countQuery)->where('stage', 'delivered')->count(),
        ];

        return Inertia::render('Jobs/AllJobs', [
            'jobs' => JobResource::collection($jobs)->response()->getData(true),
            'customers' => $customers,
            'totalJobsCount' => $totalJobsCount,
            'outcomeGroupCounts' => $outcomeGroupCounts,
            'testers' => $testers,
            'technicians' => $technicians,
            'tokenPreview' => $previewToken,
            'filters' => $request->only(['search', 'stage', 'outcome', 'outcome_group', 'priority', 'technician_id', 'customer_id', 'from', 'to', 'unpaid']),
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function delivery(Request $request): Response
    {
        $query = Job::with(['customer', 'technician', 'tester'])
            ->whereIn('stage', ['ready', 'delivered']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('token_no', 'like', "%{$search}%")
                  ->orWhere('product_name', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%");
                  });
            });
        }

        $status = $request->input('status');
        if (! $status) {
            $status = 'ready';
        }

        if (in_array($status, ['ready', 'delivered'])) {
            $query->where('stage', $status);
        }

        $jobs = $query->orderBy('updated_at', 'desc')
            ->paginate($request->input('per_page', 30))
            ->withQueryString();

        return Inertia::render('Delivery/Index', [
            'jobs' => JobResource::collection($jobs)->response()->getData(true),
            'filters' => ['search' => $search, 'status' => $status],
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function reports(Request $request): Response
    {
        $query = Job::with(['customer', 'tester', 'technician', 'creator'])
            ->orderBy('id', 'asc'); // Strictly ordered by id ASC (insertion order)

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

        if ($request->boolean('unpaid')) {
            $query->where('is_paid', false)
                  ->whereNotNull('payable_amount')
                  ->where('payable_amount', '>', 0);
        }

        $jobs = $query->paginate($request->input('per_page', 30))
            ->withQueryString();

        $analyticsQuery = Job::query();
        if ($from) {
            $analyticsQuery->whereDate('in_date', '>=', $from);
        }
        if ($to) {
            $analyticsQuery->whereDate('in_date', '<=', $to);
        }
        if ($stage) {
            $analyticsQuery->where('stage', $stage);
        }
        if ($outcome) {
            $analyticsQuery->where('outcome', $outcome);
        }
        if ($request->boolean('unpaid')) {
            $analyticsQuery->where('is_paid', false)
                   ->whereNotNull('payable_amount')
                   ->where('payable_amount', '>', 0);
        }

        $totalJobs = (clone $analyticsQuery)->count();
        $completedJobs = (clone $analyticsQuery)->whereIn('stage', ['completed', 'ready', 'delivered'])->count();

        $analytics = [
            'total_jobs' => $totalJobs,
            'total_payable' => (float) (clone $analyticsQuery)->sum('payable_amount'),
            'total_paid' => (float) (clone $analyticsQuery)->where('is_paid', true)->sum('payable_amount'),
            'total_unpaid' => (float) (clone $analyticsQuery)->where('is_paid', false)->where('payable_amount', '>', 0)->sum('payable_amount'),
            'completed_count' => $completedJobs,
            'completion_rate' => $totalJobs > 0 ? round(($completedJobs / $totalJobs) * 100, 1) : 0,
            'outcomes' => [
                'work_done' => (clone $analyticsQuery)->where('outcome', 'work_done')->count(),
                'ok_no_fault' => (clone $analyticsQuery)->where('outcome', 'ok_no_fault')->count(),
                'not_approved' => (clone $analyticsQuery)->where('outcome', 'not_approved')->count(),
                'not_repairable' => (clone $analyticsQuery)->where('outcome', 'not_repairable')->count(),
                'cancelled' => (clone $analyticsQuery)->where('outcome', 'cancelled')->count(),
            ],
        ];

        return Inertia::render('Reports/Index', [
            'jobs' => JobResource::collection($jobs)->response()->getData(true),
            'analytics' => $analytics,
            'filters' => $request->only(['from', 'to', 'stage', 'outcome', 'unpaid']),
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function users(Request $request): Response
    {
        $users = User::with('roles')
            ->orderBy('id', 'asc')
            ->paginate($request->input('per_page', 30))
            ->withQueryString();

        $roles = Role::all(['id', 'name']);

        return Inertia::render('Users/Index', [
            'users' => UserResource::collection($users)->response()->getData(true),
            'roles' => $roles,
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function accounts(Request $request): Response
    {
        if (! $request->user()?->hasRole('admin')) {
            abort(403, 'Unauthorized. Only admins can access the Accounts module.');
        }

        $query = Job::with(['customer', 'creator', 'technician']);

        // Customer Filter
        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        // Date Range Filter for Period Revenue (Default: Last 30 Days)
        $fromDateInput = $request->input('from_date');
        $toDateInput   = $request->input('to_date');

        $fromDate = $fromDateInput ? Carbon::parse($fromDateInput)->startOfDay() : Carbon::today()->subDays(30)->startOfDay();
        $toDate   = $toDateInput   ? Carbon::parse($toDateInput)->endOfDay()   : Carbon::today()->endOfDay();

        // Filter unpaid only if requested
        $unpaidOnly = $request->boolean('unpaid_only');
        if ($unpaidOnly) {
            $query->where('is_paid', false)
                  ->whereNotNull('payable_amount')
                  ->where('payable_amount', '>', 0);
        }

        // 1. Total Revenue (All time paid)
        $totalRevenue = (float) (clone $query)
            ->where('is_paid', true)
            ->sum('payable_amount');

        // 2. Dues Amount (Unpaid balances)
        $totalDues = (float) (clone $query)
            ->where('is_paid', false)
            ->whereNotNull('payable_amount')
            ->sum('payable_amount');

        // 3. Period Revenue (Filtered range revenue)
        $periodRevenue = (float) (clone $query)
            ->where('is_paid', true)
            ->whereBetween('updated_at', [$fromDate, $toDate])
            ->sum('payable_amount');

        // Counts
        $paidJobsCount   = (clone $query)->where('is_paid', true)->count();
        $unpaidJobsCount = (clone $query)->where('is_paid', false)->whereNotNull('payable_amount')->count();

        // Customer-wise Dues Breakdown
        $duesBreakdownQuery = Customer::whereHas('jobs', function ($q) {
            $q->where('is_paid', false)
              ->whereNotNull('payable_amount')
              ->where('payable_amount', '>', 0);
        });

        if ($customerId) {
            $duesBreakdownQuery->where('id', $customerId);
        }

        $duesBreakdown = $duesBreakdownQuery
            ->with(['jobs' => function ($q) {
                $q->where('is_paid', false)
                  ->whereNotNull('payable_amount')
                  ->where('payable_amount', '>', 0);
            }])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($c) {
                return [
                    'id' => $c->id,
                    'name' => $c->name,
                    'customer_code' => $c->customer_code,
                    'mobile' => $c->mobile,
                    'total_due' => (float) $c->jobs->sum('payable_amount'),
                    'due_jobs_count' => $c->jobs->count(),
                    'jobs' => $c->jobs->map(function ($j) {
                        return [
                            'id' => $j->id,
                            'customer_id' => $j->customer_id,
                            'token_no' => $j->token_no,
                            'product_name' => $j->product_name,
                            'brand' => $j->brand,
                            'serial_no' => $j->serial_no,
                            'stage' => $j->stage,
                            'payable_amount' => (float) $j->payable_amount,
                            'in_date' => $j->in_date,
                            'created_at' => $j->created_at ? $j->created_at->format('Y-m-d H:i:s') : null,
                        ];
                    })->values(),
                ];
            })->values();

        // Paginated Job Financial Transactions
        $perPage = (int) $request->input('per_page', 30);
        $transactions = (clone $query)
            ->whereNotNull('payable_amount')
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage)
            ->withQueryString();

        // Customers list for dropdown filter
        $customers = Customer::orderBy('name', 'asc')->get(['id', 'name', 'customer_code', 'mobile']);

        return Inertia::render('Accounts/Index', [
            'transactions' => JobResource::collection($transactions)->response()->getData(true),
            'customers'    => $customers,
            'duesBreakdown'=> $duesBreakdown,
            'summary'      => [
                'total_revenue'     => $totalRevenue,
                'total_dues'        => $totalDues,
                'period_revenue'    => $periodRevenue,
                'paid_jobs_count'   => $paidJobsCount,
                'unpaid_jobs_count' => $unpaidJobsCount,
            ],
            'filters' => [
                'customer_id' => $customerId ? (string) $customerId : '',
                'from_date'   => $fromDate->format('Y-m-d'),
                'to_date'     => $toDate->format('Y-m-d'),
                'unpaid_only' => $unpaidOnly,
            ],
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function togglePayment(Request $request, Job $job): RedirectResponse
    {
        if (! $request->user()?->hasRole('admin')) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'is_paid' => ['required', 'boolean'],
            'payment_mode' => ['nullable', 'string'],
        ]);

        $job->is_paid = $request->boolean('is_paid');
        if ($request->filled('payment_mode')) {
            $job->payment_mode = $request->input('payment_mode');
        }
        if ($job->is_paid && ! $job->paid_at) {
            $job->paid_at = now();
        }
        $job->save();

        return redirect()->back()->with('success', 'Payment status updated successfully.');
    }

    public function settings(): Response
    {
        $allSettings = [
            'inspection_fee' => Setting::get('inspection_fee', 250),
            'token_prefix' => Setting::get('token_prefix', 'SES'),
            'customer_code_prefix' => Setting::get('customer_code_prefix', 'C'),
            'business_name' => Setting::get('business_name', 'Seekoji Electric'),
            'whatsapp_enabled' => Setting::get('whatsapp_enabled', '0'),
        ];

        return Inertia::render('Settings/Index', [
            'settings' => $allSettings,
            'sanctumToken' => session('sanctum_token'),
        ]);
    }

    public function storeJob(\App\Http\Requests\JobStoreRequest $request): \Illuminate\Http\JsonResponse
    {
        return app(\App\Http\Controllers\Api\V1\JobController::class)->store($request);
    }

    public function searchCustomers(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        return app(\App\Http\Controllers\Api\V1\CustomerController::class)->index($request);
    }

    public function updateJob(\App\Http\Requests\JobUpdateRequest $request, Job $job): \Illuminate\Http\JsonResponse
    {
        return app(\App\Http\Controllers\Api\V1\JobController::class)->update($request, $job);
    }

    public function destroyJob(Request $request, Job $job): \Illuminate\Http\JsonResponse
    {
        if (! $request->user()?->hasRole('admin')) {
            abort(403, 'Unauthorized. Only admins can delete work orders.');
        }

        return app(\App\Http\Controllers\Api\V1\JobController::class)->destroy($request, $job);
    }

    public function destroyCustomer(Request $request, Customer $customer): \Illuminate\Http\JsonResponse
    {
        if (! $request->user()?->hasRole('admin')) {
            abort(403, 'Unauthorized. Only admins can delete customer records.');
        }

        return app(\App\Http\Controllers\Api\V1\CustomerController::class)->destroy($request, $customer);
    }
}
