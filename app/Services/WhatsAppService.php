<?php

namespace App\Services;

use App\Models\NotificationLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    protected string $token;
    protected string $phoneNumberId;
    protected string $apiUrl;

    public function __construct()
    {
        $this->token = config('services.whatsapp.token', env('WHATSAPP_TOKEN', ''));
        $this->phoneNumberId = config('services.whatsapp.phone_number_id', env('WHATSAPP_PHONE_NUMBER_ID', ''));
        $this->apiUrl = "https://graph.facebook.com/v19.0/{$this->phoneNumberId}/messages";
    }

    /**
     * Dispatch WhatsApp template message via Meta Graph API and record in notification_logs.
     */
    public function sendMessage(string $mobile, string $template, array $params = [], ?int $jobId = null, ?int $customerId = null, ?int $dispatchId = null): NotificationLog
    {
        $formattedMobile = preg_replace('/[^0-9]/', '', $mobile);
        if (strlen($formattedMobile) === 10) {
            $formattedMobile = '91' . $formattedMobile;
        }

        $log = NotificationLog::create([
            'job_id' => $jobId,
            'customer_id' => $customerId,
            'dispatch_id' => $dispatchId,
            'template' => $template,
            'status' => 'queued',
        ]);

        // If credentials are not configured, simulate message in dev mode
        if (empty($this->token) || empty($this->phoneNumberId)) {
            Log::info("WhatsApp Simulated [{$template}] to {$formattedMobile}: " . json_encode($params));
            $log->update([
                'status' => 'sent',
                'wamid' => 'sim_' . uniqid(),
                'sent_at' => now(),
            ]);
            return $log;
        }

        try {
            $response = Http::withToken($this->token)->post($this->apiUrl, [
                'messaging_product' => 'whatsapp',
                'to' => $formattedMobile,
                'type' => 'template',
                'template' => [
                    'name' => $template,
                    'language' => ['code' => 'en_US'],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => array_map(fn ($val) => ['type' => 'text', 'text' => (string) $val], $params),
                        ],
                    ],
                ],
            ]);

            if ($response->successful()) {
                $responseData = $response->json();
                $wamid = $responseData['messages'][0]['id'] ?? null;
                $log->update([
                    'status' => 'sent',
                    'wamid' => $wamid,
                    'sent_at' => now(),
                ]);
            } else {
                $log->update([
                    'status' => 'failed',
                    'error' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("WhatsApp API Exception: " . $e->getMessage());
            $log->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);
        }

        return $log;
    }
}
