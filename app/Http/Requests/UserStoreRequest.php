<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UserStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'digits:10'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,intake_coordinator,tester,technician'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
