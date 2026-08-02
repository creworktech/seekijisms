<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SettingUpdateRequest;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Setting::allCached(),
        ], 200);
    }

    public function update(SettingUpdateRequest $request): JsonResponse
    {
        foreach ($request->validated() as $key => $value) {
            if ($value !== null) {
                Setting::set($key, (string) $value);
            }
        }

        return response()->json([
            'data' => Setting::allCached(),
            'message' => 'Settings updated successfully',
        ], 200);
    }
}
