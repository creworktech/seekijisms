<?php

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\DispatchReceiveRequest;
use App\Http\Requests\Logistics\DispatchStoreRequest;
use App\Http\Requests\Logistics\DispatchUpdateRequest;
use App\Http\Resources\Logistics\DispatchResource;
use App\Models\Dispatch;
use App\Models\LogisticsUser;
use App\Services\DispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class DispatchController extends Controller
{
    public function __construct(
        private readonly DispatchService $dispatches,
    ) {
    }

    public function sent(Request $request): AnonymousResourceCollection
    {
        $status = $this->status($request);

        $dispatches = Dispatch::query()
            ->with(['receiver.location', 'fromStop', 'toStop'])
            ->where('sender_id', $request->user()->id)
            ->where('status', $status)
            ->latest('dispatch_date')
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return DispatchResource::collection($dispatches);
    }

    /**
     * Scoped to the receiver's location, not the individual — rule 2 of the
     * locked decisions means any active colleague there may act on it.
     */
    public function received(Request $request): AnonymousResourceCollection
    {
        /** @var LogisticsUser $user */
        $user = $request->user();
        $status = $this->status($request);

        $dispatches = Dispatch::query()
            ->with(['sender.location', 'fromStop', 'toStop'])
            ->whereHas('receiver', fn ($q) => $q->where('location_id', $user->location_id))
            ->where('status', $status)
            ->latest('dispatch_date')
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return DispatchResource::collection($dispatches);
    }

    public function show(Request $request, Dispatch $dispatch): DispatchResource
    {
        $this->authorizeView($request->user(), $dispatch);

        return new DispatchResource($dispatch->load([
            'sender.location', 'receiver.location', 'receivedBy',
            'fromStop', 'toStop', 'photos', 'events.user',
        ]));
    }

    public function store(DispatchStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['bus_photos'] = $request->file('bus_photos', []);
        $data['package_photos'] = $request->file('package_photos', []);

        $dispatch = $this->dispatches->create($data, $request->user());

        // A replayed idempotency key answers 200 with the original dispatch;
        // only a genuine insert is 201.
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

    public function update(DispatchUpdateRequest $request, Dispatch $dispatch): JsonResponse
    {
        $data = $request->validated();
        $data['bus_photos'] = $request->file('bus_photos', []);
        $data['package_photos'] = $request->file('package_photos', []);

        $updated = $this->dispatches->update($dispatch, $request->user(), $data);

        return (new DispatchResource($updated))
            ->additional(['message' => 'Dispatch updated.'])
            ->response();
    }

    public function receive(DispatchReceiveRequest $request, Dispatch $dispatch): JsonResponse
    {
        $data = $request->validated();
        $data['receipt_photo'] = $request->file('receipt_photo');

        $updated = $request->input('action') === DispatchStatus::RECEIVED->value
            ? $this->dispatches->markReceived($dispatch, $request->user(), $data)
            : $this->dispatches->markNotReceived($dispatch, $request->user(), $data);

        return (new DispatchResource($updated))
            ->additional(['message' => "Dispatch {$updated->reference_no} marked {$updated->status->label()}."])
            ->response();
    }

    private function status(Request $request): string
    {
        $status = (string) $request->query('status', DispatchStatus::PENDING->value);

        return in_array($status, DispatchStatus::values(), true)
            ? $status
            : DispatchStatus::PENDING->value;
    }

    /**
     * A dispatch is visible to its sender, to anyone at the receiving
     * location, and to logistics admins.
     */
    private function authorizeView(LogisticsUser $user, Dispatch $dispatch): void
    {
        if ($dispatch->sender_id === $user->id) {
            return;
        }

        $dispatch->loadMissing('receiver');

        if ($dispatch->receiver && $dispatch->receiver->location_id === $user->location_id) {
            return;
        }

        throw new AccessDeniedHttpException('You do not have access to this dispatch.');
    }
}
