<?php

namespace App\Enums;

enum DispatchStatus: string
{
    case PENDING = 'pending';
    case RECEIVED = 'received';
    case NOT_RECEIVED = 'not_received';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'Pending',
            self::RECEIVED => 'Received',
            self::NOT_RECEIVED => 'Not Received',
        };
    }
}
