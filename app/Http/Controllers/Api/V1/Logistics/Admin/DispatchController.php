<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\Admin\DispatchAdminReceiveRequest;
use App\Http\Requests\Logistics\Admin\DispatchAdminStoreRequest;
use App\Http\Resources\Logistics\DispatchResource;
use App\Models\Dispatch;
use App\Models\LogisticsUser;
use App\Services\DispatchPhotoService;
use App\Services\DispatchService;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DispatchController extends Controller
{
    public function __construct(
        private readonly DispatchPhotoService $photos,
        private readonly DispatchService $dispatches,
    ) {
    }

    /**
     * The admin picks who the sender is — the acting user is an SMS admin,
     * never a LogisticsUser, so it can't be threaded through as the sender
     * the way the mobile create endpoint does.
     */
    public function store(DispatchAdminStoreRequest $request): JsonResponse
    {
        $sender = LogisticsUser::findOrFail($request->validated('sender_id'));

        $data = $request->validated();
        $data['bus_photos'] = $request->file('bus_photos', []);
        $data['package_photos'] = $request->file('package_photos', []);

        $dispatch = $this->dispatches->create($data, $sender);
        $created = $dispatch->wasRecentlyCreated;

        return (new DispatchResource($dispatch))
            ->additional([
                'message' => $created
                    ? "Dispatch {$dispatch->reference_no} created."
                    : "Dispatch {$dispatch->reference_no} was already submitted.",
            ])
            ->response()
            ->setStatusCode($created ? 201 : 200);
    }

    /**
     * Same reasoning as store(): the confirming party is whichever
     * LogisticsUser the admin names, not the SMS admin themselves.
     */
    public function receive(DispatchAdminReceiveRequest $request, Dispatch $dispatch): JsonResponse
    {
        $actor = LogisticsUser::findOrFail($request->validated('acting_user_id'));

        $data = $request->validated();
        $data['receipt_photo'] = $request->file('receipt_photo');

        $updated = $request->input('action') === DispatchStatus::RECEIVED->value
            ? $this->dispatches->markReceived($dispatch, $actor, $data)
            : $this->dispatches->markNotReceived($dispatch, $actor, $data);

        return (new DispatchResource($updated))
            ->additional(['message' => "Dispatch {$updated->reference_no} marked {$updated->status->label()}."])
            ->response();
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $dispatches = $this->filtered($request)
            ->with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
            ->latest('dispatch_date')
            ->latest('id')
            ->paginate((int) $request->query('per_page', 25))
            ->withQueryString();

        return DispatchResource::collection($dispatches);
    }

    public function show(Dispatch $dispatch): DispatchResource
    {
        return new DispatchResource($dispatch->load([
            'sender.location', 'receiver.location', 'receivedBy',
            'fromStop', 'toStop', 'photos', 'events.user',
        ]));
    }

    /**
     * Soft-deletes the dispatch and permanently removes its photo files.
     * The row itself is kept — reference numbers are never reused, and the
     * dispatch_events audit trail stays intact for anything that still
     * needs to explain what happened — but the photos are real files taking
     * real storage, so they are actually deleted rather than left orphaned.
     */
    public function destroy(Dispatch $dispatch): JsonResponse
    {
        $dispatch->loadMissing('photos');
        $reference = $dispatch->reference_no;

        $this->photos->deleteAll($dispatch);
        $dispatch->delete();

        return response()->json(['message' => "Dispatch {$reference} deleted."]);
    }

    private function filtered(Request $request): Builder
    {
        return Dispatch::query()
            ->when(
                $request->filled('status') && in_array($request->query('status'), DispatchStatus::values(), true),
                fn ($q) => $q->where('status', $request->query('status'))
            )
            ->when($request->filled('from'), fn ($q) => $q->whereDate('dispatch_date', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('dispatch_date', '<=', $request->query('to')))
            ->when($request->filled('sender_id'), fn ($q) => $q->where('sender_id', $request->query('sender_id')))
            ->when($request->filled('receiver_id'), fn ($q) => $q->where('receiver_id', $request->query('receiver_id')))
            ->when($request->filled('location_id'), function ($q) use ($request) {
                $locationId = $request->query('location_id');

                // Either end of the journey touching this location counts.
                $q->where(function ($sub) use ($locationId) {
                    $sub->whereHas('sender', fn ($s) => $s->where('location_id', $locationId))
                        ->orWhereHas('receiver', fn ($s) => $s->where('location_id', $locationId));
                });
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->query('search') . '%';

                $q->where(function ($sub) use ($term) {
                    $sub->where('reference_no', 'like', $term)
                        ->orWhereHas('sender', fn ($s) => $s->where('name', 'like', $term))
                        ->orWhereHas('receiver', fn ($s) => $s->where('name', 'like', $term));
                });
            });
    }
}
