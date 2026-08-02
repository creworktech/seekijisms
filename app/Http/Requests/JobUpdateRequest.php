<?php

namespace App\Http\Requests;

use App\Models\Job;
use Illuminate\Foundation\Http\FormRequest;

class JobUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('jobs.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'product_name' => ['sometimes', 'required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'serial_no' => ['nullable', 'string', 'max:255'],
            'power_rating' => ['nullable', 'string', 'max:255'],
            'fault_description' => ['sometimes', 'nullable', 'string'],
            'customer_remark' => ['nullable', 'string'],
            'received_from' => ['sometimes', 'nullable', 'string'],
            'priority' => ['nullable', 'string'],
        ];
    }
}
