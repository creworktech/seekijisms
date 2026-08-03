<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class CounterService
{
    public function nextJobToken(): string
    {
        return DB::transaction(function () {
            $prefixSetting = Setting::get('token_prefix', 'SES');
            $tokenKey = 'job_token';

            $row = DB::table('counters')->where('key', $tokenKey)->lockForUpdate()->first();

            if (! $row) {
                DB::table('counters')->insert(['key' => $tokenKey, 'value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = $row->value + 1;
                DB::table('counters')->where('key', $tokenKey)->update(['value' => $nextVal]);
            }

            return $prefixSetting . $nextVal;
        });
    }

    public function nextCustomerCode(): string
    {
        return DB::transaction(function () {
            $prefix = Setting::get('customer_code_prefix', 'C');

            $row = DB::table('counters')->where('key', 'customer_code')->lockForUpdate()->first();

            if (! $row) {
                DB::table('counters')->insert(['key' => 'customer_code', 'value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = $row->value + 1;
                DB::table('counters')->where('key', 'customer_code')->update(['value' => $nextVal]);
            }

            return $prefix . str_pad((string) $nextVal, 5, '0', STR_PAD_LEFT);
        });
    }
}
