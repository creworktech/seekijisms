<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Job;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class CounterService
{
    public function nextJobToken(): string
    {
        return DB::transaction(function () {
            $prefixSetting = Setting::get('token_prefix', 'SES');
            $tokenKey = 'job_token';

            // Auto-reset counter to 0 if all work orders have been deleted from DB
            if (Job::withTrashed()->count() === 0) {
                DB::table('counters')->updateOrInsert(['key' => $tokenKey], ['value' => 0]);
            }

            $row = DB::table('counters')->where('key', $tokenKey)->lockForUpdate()->first();

            if (! $row || (int) $row->value <= 0) {
                DB::table('counters')->updateOrInsert(['key' => $tokenKey], ['value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = (int) $row->value + 1;
                DB::table('counters')->where('key', $tokenKey)->update(['value' => $nextVal]);
            }

            return $prefixSetting . $nextVal;
        });
    }

    public function nextCustomerCode(): string
    {
        return DB::transaction(function () {
            $prefix = Setting::get('customer_code_prefix', 'C');
            $counterKey = 'customer_code';

            // Auto-reset counter to 0 if all customers have been deleted from DB
            if (Customer::withTrashed()->count() === 0) {
                DB::table('counters')->updateOrInsert(['key' => $counterKey], ['value' => 0]);
            }

            $row = DB::table('counters')->where('key', $counterKey)->lockForUpdate()->first();

            if (! $row || (int) $row->value <= 0) {
                DB::table('counters')->updateOrInsert(['key' => $counterKey], ['value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = (int) $row->value + 1;
                DB::table('counters')->where('key', $counterKey)->update(['value' => $nextVal]);
            }

            return $prefix . str_pad((string) $nextVal, 5, '0', STR_PAD_LEFT);
        });
    }

    public function resetCounters(): void
    {
        DB::table('counters')->update(['value' => 0]);
    }
}
