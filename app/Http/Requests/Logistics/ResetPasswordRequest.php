<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'min:6', 'max:72'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Enter the new password.',
            'password.min' => 'The password must be at least 6 characters.',
        ];
    }
}
