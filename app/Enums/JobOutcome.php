<?php

namespace App\Enums;

enum JobOutcome: string
{
    case OK_NO_FAULT = 'ok_no_fault';
    case WORK_DONE = 'work_done';
    case NOT_REPAIRABLE = 'not_repairable';
    case NOT_APPROVED = 'not_approved';
    case CANCELLED = 'cancelled';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
