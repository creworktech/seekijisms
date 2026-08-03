<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CustomerUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        $customerId = $this->route('customer')?->id ?? $this->route('customer');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'mobile' => [
                'sometimes', 'required', 'digits:10', 'regex:/^[6-9]\d{9}$/',
                Rule::unique('customers', 'mobile')->ignore($customerId),
            ],
            'address' => ['sometimes', 'required', 'string', 'max:500'],
            'registered_on' => ['nullable', 'date', 'before_or_equal:today'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
