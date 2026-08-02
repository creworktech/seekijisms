<?php

namespace App\Events;

use App\Models\Job;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentCollected
{
    use Dispatchable, SerializesModels;

    public function __construct(public Job $job, public float $amount, public string $mode) {}
}
