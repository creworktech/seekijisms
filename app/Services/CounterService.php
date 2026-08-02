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
            $dateStr = now()->format('dm'); // DDMM format, e.g. 3107
            $todayKey = 'job_token_' . now()->format('Ymd');

            $row = DB::table('counters')->where('key', $todayKey)->lockForUpdate()->first();

            if (! $row) {
                DB::table('counters')->insert(['key' => $todayKey, 'value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = $row->value + 1;
                DB::table('counters')->where('key', $todayKey)->update(['value' => $nextVal]);
            }

            $paddedNum = str_pad((string) $nextVal, 3, '0', STR_PAD_LEFT);

            if (str_contains($prefixSetting, 'DDMM')) {
                $prefix = str_replace('DDMM', $dateStr, $prefixSetting);
                return $prefix . $paddedNum;
            }

            return $prefixSetting . $dateStr . $paddedNum;
        });
    }

    public function nextCustomerCode(): string
    {
        return DB::transaction(function () {
            $prefix = Setting::get('customer_code_prefix', 'ID');

            $row = DB::table('counters')->where('key', 'customer_code')->lockForUpdate()->first();

            if (! $row) {
                DB::table('counters')->insert(['key' => 'customer_code', 'value' => 1]);
                $nextVal = 1;
            } else {
                $nextVal = $row->value + 1;
                DB::table('counters')->where('key', 'customer_code')->update(['value' => $nextVal]);
            }

            return $prefix . str_pad((string) $nextVal, 3, '0', STR_PAD_LEFT);
        });
    }
}
