<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Dispatch photo storage
    |--------------------------------------------------------------------------
    |
    | Which filesystem disk holds dispatch evidence photos. 'local' keeps them
    | on the server under storage/app/private; 'r2' puts them in Cloudflare R2.
    |
    | Whatever the disk, the bucket or directory must stay private. Photos are
    | only ever reachable through an authorisation check.
    |
    */

    'photo_disk' => env('LOGISTICS_PHOTO_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Presigned URL lifetime
    |--------------------------------------------------------------------------
    |
    | How long a generated photo link stays valid, in minutes. Long enough that
    | a detail screen left open still renders its images, short enough that a
    | leaked link expires quickly.
    |
    | Only applies to disks that support temporary URLs; the local disk falls
    | back to streaming through an authenticated route.
    |
    */

    'photo_url_ttl' => (int) env('LOGISTICS_PHOTO_URL_TTL', 30),

];
