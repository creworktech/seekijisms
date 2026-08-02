<?php

namespace App\Listeners;

use App\Events\JobTransitioned;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendJobNotification implements ShouldQueue
{
    use InteractsWithQueue;

    public function __construct(
        protected WhatsAppService $whatsAppService
    ) {}

    public function handle(JobTransitioned $event): void
    {
        if (! $event->sendWhatsApp) {
            return;
        }

        $job = $event->job->loadMissing('customer');
        $customer = $job->customer;

        if (! $customer || ! $customer->mobile) {
            return;
        }

        $actionTemplates = [
            'assign_tester' => 'job_under_testing',
            'fault_found' => 'job_estimation_ready',
            'approve' => 'job_repair_approved',
            'work_done' => 'job_repair_completed',
            'deliver' => 'job_delivered',
            'cancel' => 'job_cancelled',
            'not_repairable' => 'job_not_repairable',
            'mark_pending' => 'job_status_pending',
        ];

        $template = $actionTemplates[$event->action] ?? 'job_status_update';
        $params = [
            $customer->name,
            $job->token_no,
            strtoupper($job->stage),
        ];

        $this->whatsAppService->sendMessage(
            $customer->mobile,
            $template,
            $params,
            $job->id,
            $customer->id
        );
    }
}
