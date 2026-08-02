<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SettingUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'inspection_fee' => ['required', 'numeric', 'min:0', 'max:100000'],
            'token_prefix' => ['nullable', 'string', 'max:10'],
            'customer_code_prefix' => ['nullable', 'string', 'max:10'],
            'business_name' => ['nullable', 'string', 'max:120'],
            'whatsapp_enabled' => ['nullable'],
        ];
    }
}
