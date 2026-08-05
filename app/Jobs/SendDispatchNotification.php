<?php

namespace App\Jobs;

use App\Models\Dispatch;
use App\Models\LogisticsUser;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Queued WhatsApp notification for a dispatch lifecycle event.
 *
 * Sends through the same Meta integration the Service Management System
 * uses, and records every message in notification_logs. Always queued and
 * never inline: a Meta outage must not be able to fail the database
 * transition that triggered it.
 */
class SendDispatchNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const EVENT_CREATED = 'dispatch.created';
    public const EVENT_RECEIVED = 'dispatch.received';
    public const EVENT_NOT_RECEIVED = 'dispatch.not_received';

    /** Meta template names, to be created in the WhatsApp Business account. */
    private const TEMPLATES = [
        self::EVENT_CREATED => 'logistics_dispatch_created',
        self::EVENT_RECEIVED => 'logistics_dispatch_received',
        self::EVENT_NOT_RECEIVED => 'logistics_dispatch_not_received',
    ];

    public int $tries = 3;

    public array $backoff = [10, 30, 60];

    public function __construct(
        public Dispatch $dispatch,
        public string $event,
    ) {
    }

    public function handle(WhatsAppService $whatsApp): void
    {
        $template = self::TEMPLATES[$this->event] ?? null;

        if (! $template) {
            return;
        }

        $dispatch = $this->dispatch->loadMissing(['sender', 'receiver', 'toStop', 'receivedBy']);

        foreach ($this->recipients($dispatch) as $recipient) {
            if (empty($recipient['mobile'])) {
                continue;
            }

            $whatsApp->sendMessage(
                $recipient['mobile'],
                $template,
                $this->params($dispatch, $recipient['name']),
                null,
                null,
                $dispatch->id,
            );
        }
    }

    /**
     * @return array<int, array{name: string, mobile: ?string}>
     */
    private function recipients(Dispatch $dispatch): array
    {
        $asRecipient = static fn (?LogisticsUser $u) => $u
            ? [['name' => $u->name, 'mobile' => $u->mobile]]
            : [];

        return match ($this->event) {
            self::EVENT_CREATED => $asRecipient($dispatch->receiver),

            self::EVENT_RECEIVED => $asRecipient($dispatch->sender),

            // Not Received notifies the sender and flags the dispatch for
            // admin. Logistics accounts are field staff only, so "admin"
            // means the Service Management System users who run the panel.
            self::EVENT_NOT_RECEIVED => array_merge(
                $asRecipient($dispatch->sender),
                $this->serviceAdmins(),
            ),

            default => [],
        };
    }

    /**
     * @return array<int, array{name: string, mobile: ?string}>
     */
    private function serviceAdmins(): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereNotNull('phone')
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->get()
            ->map(fn (User $u) => ['name' => $u->name, 'mobile' => $u->phone])
            ->all();
    }

    /**
     * Ordered body parameters for the Meta template.
     *
     * @return array<int, string>
     */
    private function params(Dispatch $dispatch, string $recipientName): array
    {
        $actor = $dispatch->receivedBy?->name ?? $dispatch->receiver?->name ?? 'The receiver';

        return match ($this->event) {
            // "{1}, {2} has sent {3} to {4}. The bus left the pickup stand
            //  at {5}." bus_leave_time is departure FROM the pickup stand,
            //  which is what tells the receiver when to expect the bus.
            self::EVENT_CREATED => [
                $recipientName,
                $dispatch->sender?->name ?? 'a sender',
                $dispatch->reference_no,
                $dispatch->toStop?->name ?? 'the drop stop',
                $this->formatTime($dispatch->bus_leave_time),
            ],

            self::EVENT_RECEIVED => [
                $recipientName,
                $actor,
                $dispatch->reference_no,
            ],

            self::EVENT_NOT_RECEIVED => [
                $recipientName,
                $actor,
                $dispatch->reference_no,
                $dispatch->receipt_note ?? 'no reason given',
            ],

            default => [$dispatch->reference_no],
        };
    }

    private function formatTime(mixed $time): string
    {
        if (! $time) {
            return '';
        }

        try {
            return Carbon::parse((string) $time)->format('h:i A');
        } catch (\Throwable) {
            return (string) $time;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Dispatch WhatsApp notification permanently failed', [
            'dispatch_id' => $this->dispatch->id,
            'event' => $this->event,
            'error' => $exception->getMessage(),
        ]);
    }
}
