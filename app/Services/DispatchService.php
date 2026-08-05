<?php

namespace App\Services;

use App\Enums\DispatchStatus;
use App\Exceptions\DispatchTransitionException;
use App\Jobs\SendDispatchNotification;
use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\DispatchPhoto;
use App\Models\LogisticsUser;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The single place that creates or changes a dispatch. Controllers must never
 * write $dispatch->status directly.
 */
class DispatchService
{
    public function __construct(
        private readonly DispatchPhotoService $photos,
    ) {
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, LogisticsUser $sender): Dispatch
    {
        $clientUuid = $data['client_uuid'] ?? null;

        // A retry of an upload whose response was lost must not create a
        // second parcel. Answer with the original instead.
        if ($clientUuid && $replay = $this->findByClientUuid($clientUuid)) {
            return $replay;
        }

        // Photos stored during the transaction below are tracked here so
        // they can be cleaned up if anything after them fails — the upload
        // to disk is a real side effect that DB::transaction() cannot roll
        // back on its own.
        $uploadedPhotos = [];

        try {
            $dispatch = DB::transaction(function () use ($data, $sender, $clientUuid, &$uploadedPhotos) {
                $dispatch = Dispatch::create([
                    'reference_no' => $this->nextReference(),
                    'client_uuid' => $clientUuid,
                    'sender_id' => $sender->id,
                    'receiver_id' => $data['receiver_id'],
                    'from_stop_id' => $data['from_stop_id'],
                    'to_stop_id' => $data['to_stop_id'],
                    'item_description' => $data['item_description'],
                    'quantity' => $data['quantity'],
                    'bus_number' => strtoupper((string) $data['bus_number']),
                    'driver_mobile' => $data['driver_mobile'] ?? null,
                    'receiver_mobile' => $data['receiver_mobile'] ?? null,
                    'bus_reach_time' => $data['bus_reach_time'],
                    'bus_leave_time' => $data['bus_leave_time'],
                    'remarks' => $data['remarks'] ?? null,
                    'status' => DispatchStatus::PENDING,
                    'dispatch_date' => $data['dispatch_date'] ?? now()->toDateString(),
                ]);

                $uploadedPhotos = [
                    ...$this->photos->storeMany($dispatch, $data['bus_photos'] ?? [], DispatchPhoto::TYPE_BUS),
                    ...$this->photos->storeMany($dispatch, $data['package_photos'] ?? [], DispatchPhoto::TYPE_PACKAGE),
                ];

                $this->recordEvent(
                    $dispatch,
                    $sender,
                    'created',
                    null,
                    DispatchStatus::PENDING,
                    "Dispatch created by {$sender->name}."
                );

                return $dispatch;
            });
        } catch (UniqueConstraintViolationException $e) {
            $this->photos->deleteFiles($uploadedPhotos);

            // Two retries raced and the index rejected the loser. Whichever
            // one committed is the dispatch both callers should see.
            if ($clientUuid && $replay = $this->findByClientUuid($clientUuid)) {
                return $replay;
            }

            throw $e;
        } catch (\Throwable $e) {
            $this->photos->deleteFiles($uploadedPhotos);

            throw $e;
        }

        SendDispatchNotification::dispatch($dispatch, SendDispatchNotification::EVENT_CREATED);

        $fresh = $dispatch->fresh($this->relations());

        // fresh() returns a new instance, which loses the flag the controller
        // uses to answer 201 Created rather than 200 OK on a replay.
        $fresh->wasRecentlyCreated = true;

        return $fresh;
    }

    /**
     * An already-committed dispatch for this idempotency key, if any.
     */
    private function findByClientUuid(string $clientUuid): ?Dispatch
    {
        return Dispatch::where('client_uuid', $clientUuid)->first()?->load($this->relations());
    }

    /**
     * Rule 8: editable only while pending, and only by its sender.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Dispatch $dispatch, LogisticsUser $actor, array $data): Dispatch
    {
        $uploadedPhotos = [];

        try {
            return DB::transaction(function () use ($dispatch, $actor, $data, &$uploadedPhotos) {
                /** @var Dispatch $locked */
                $locked = Dispatch::query()->lockForUpdate()->findOrFail($dispatch->id);

                if (! $locked->isEditableBy($actor)) {
                    throw DispatchTransitionException::notEditable();
                }

                $locked->fill(array_filter([
                    'receiver_id' => $data['receiver_id'] ?? null,
                    'from_stop_id' => $data['from_stop_id'] ?? null,
                    'to_stop_id' => $data['to_stop_id'] ?? null,
                    'item_description' => $data['item_description'] ?? null,
                    'quantity' => $data['quantity'] ?? null,
                    'bus_number' => isset($data['bus_number']) ? strtoupper((string) $data['bus_number']) : null,
                    'bus_reach_time' => $data['bus_reach_time'] ?? null,
                    'bus_leave_time' => $data['bus_leave_time'] ?? null,
                ], static fn ($value) => $value !== null));

                // Nullable fields are set separately so they can be cleared.
                foreach (['driver_mobile', 'receiver_mobile', 'remarks'] as $nullable) {
                    if (array_key_exists($nullable, $data)) {
                        $locked->{$nullable} = $data[$nullable];
                    }
                }

                $locked->save();

                foreach ([DispatchPhoto::TYPE_BUS, DispatchPhoto::TYPE_PACKAGE] as $type) {
                    $key = $type . '_photos';

                    if (! empty($data[$key])) {
                        $uploadedPhotos = [
                            ...$uploadedPhotos,
                            ...$this->photos->storeMany($locked, $data[$key], $type),
                        ];
                    }
                }

                $this->recordEvent(
                    $locked,
                    $actor,
                    'updated',
                    DispatchStatus::PENDING,
                    DispatchStatus::PENDING,
                    "Dispatch details updated by {$actor->name}."
                );

                return $locked->fresh($this->relations());
            });
        } catch (\Throwable $e) {
            $this->photos->deleteFiles($uploadedPhotos);

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function markReceived(Dispatch $dispatch, LogisticsUser $actor, array $data): Dispatch
    {
        return $this->confirm($dispatch, $actor, $data, DispatchStatus::RECEIVED);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function markNotReceived(Dispatch $dispatch, LogisticsUser $actor, array $data): Dispatch
    {
        return $this->confirm($dispatch, $actor, $data, DispatchStatus::NOT_RECEIVED);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function confirm(
        Dispatch $dispatch,
        LogisticsUser $actor,
        array $data,
        DispatchStatus $target
    ): Dispatch {
        $uploadedPhotos = [];

        try {
            $updated = DB::transaction(function () use ($dispatch, $actor, $data, $target, &$uploadedPhotos) {
                /** @var Dispatch $locked */
                $locked = Dispatch::query()->lockForUpdate()->findOrFail($dispatch->id);

                $this->assertMayConfirm($locked, $actor);

                if (! $locked->canTransitionTo($target)) {
                    throw DispatchTransitionException::alreadyFinalised($locked);
                }

                $from = $locked->status;

                $locked->status = $target;
                $locked->received_at = now();
                $locked->received_by = $actor->id;
                $locked->receipt_note = $data['note'] ?? null;
                $locked->receipt_latitude = $data['latitude'] ?? null;
                $locked->receipt_longitude = $data['longitude'] ?? null;
                $locked->save();

                if (! empty($data['receipt_photo'])) {
                    $uploadedPhotos[] = $this->photos->store($locked, $data['receipt_photo'], DispatchPhoto::TYPE_RECEIPT);
                }

                $note = $target === DispatchStatus::RECEIVED
                    ? "{$actor->name} collected the package."
                    : "{$actor->name} could not collect the package: " . ($data['note'] ?? 'no reason given');

                $this->recordEvent($locked, $actor, $target->value, $from, $target, $note, [
                    'latitude' => $data['latitude'] ?? null,
                    'longitude' => $data['longitude'] ?? null,
                ]);

                return $locked;
            });
        } catch (\Throwable $e) {
            $this->photos->deleteFiles($uploadedPhotos);

            throw $e;
        }

        SendDispatchNotification::dispatch(
            $updated,
            $target === DispatchStatus::RECEIVED
                ? SendDispatchNotification::EVENT_RECEIVED
                : SendDispatchNotification::EVENT_NOT_RECEIVED
        );

        return $updated->fresh($this->relations());
    }

    /**
     * Rule 6: the sender never changes status. Only the receiver, or another
     * active user at the receiving location, may confirm.
     */
    private function assertMayConfirm(Dispatch $dispatch, LogisticsUser $actor): void
    {
        if ($actor->id === $dispatch->sender_id) {
            throw DispatchTransitionException::senderCannotChangeStatus();
        }

        if (! $actor->is_active) {
            throw DispatchTransitionException::notAuthorisedToReceive();
        }

        $isReceiver = $actor->id === $dispatch->receiver_id;
        $sharesLocation = $dispatch->receiver && $actor->location_id === $dispatch->receiver->location_id;

        if (! $isReceiver && ! $sharesLocation) {
            throw DispatchTransitionException::notAuthorisedToReceive();
        }
    }

    /**
     * Row-locked counter. Never MAX(id)+1 — that produces duplicates under
     * concurrent submits.
     */
    private function nextReference(): string
    {
        $row = DB::table('counters')->where('key', 'dispatch_ref')->lockForUpdate()->first();

        if (! $row) {
            DB::table('counters')->insert(['key' => 'dispatch_ref', 'value' => 0]);
            $current = 0;
        } else {
            $current = (int) $row->value;
        }

        DB::table('counters')->where('key', 'dispatch_ref')->update(['value' => $current + 1]);

        return 'OD' . str_pad((string) ($current + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private function recordEvent(
        Dispatch $dispatch,
        ?LogisticsUser $actor,
        string $action,
        ?DispatchStatus $from,
        ?DispatchStatus $to,
        string $note,
        array $meta = []
    ): void {
        DispatchEvent::create([
            'dispatch_id' => $dispatch->id,
            'user_id' => $actor?->id,
            'action' => $action,
            'from_status' => $from?->value,
            'to_status' => $to?->value,
            'note' => mb_substr($note, 0, 255),
            'meta' => array_filter($meta, static fn ($value) => $value !== null) ?: null,
            'created_at' => now(),
        ]);
    }

    /**
     * @return string[]
     */
    private function relations(): array
    {
        return [
            'sender.location',
            'receiver.location',
            'receivedBy',
            'fromStop',
            'toStop',
            'photos',
            'events.user',
        ];
    }
}
