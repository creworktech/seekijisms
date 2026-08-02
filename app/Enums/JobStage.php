<?php

namespace App\Enums;

enum JobStage: string
{
    case NEW = 'new';
    case TESTING = 'testing';
    case APPROVAL = 'approval';
    case REPAIR = 'repair';
    case PENDING = 'pending';
    case COMPLETED = 'completed';
    case READY = 'ready';
    case DELIVERED = 'delivered';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
