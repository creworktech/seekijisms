<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Validation\Rule;

class LogisticsUserUpdateRequest extends LogisticsUserStoreRequest
{
    public function rules(): array
    {
        $userId = $this->route('logisticsUser')?->id;

        return array_merge(parent::rules(), [
            // Password is only set at creation; admins reset it separately.
            'password' => ['nullable', 'string', 'min:6'],
            'mobile' => [
                'required',
                'digits:10',
                'regex:/^[6-9]\d{9}$/',
                Rule::unique('logistics_users', 'mobile')->ignore($userId),
            ],
        ]);
    }
}
