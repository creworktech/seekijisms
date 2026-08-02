<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JobStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => [
                'required',
                Rule::exists('customers', 'id')->whereNull('deleted_at'),
            ],
            'received_from' => ['nullable', 'string'],
            'in_date' => ['nullable', 'date'],
            'priority' => ['nullable', 'string'],

            // Support multi-product intake array (up to 20 products)
            'products' => ['nullable', 'array', 'min:1', 'max:20'],
            'products.*.product_name' => ['required', 'string'],
            'products.*.brand' => ['nullable', 'string'],
            'products.*.serial_no' => ['nullable', 'string'],
            'products.*.power_rating' => ['nullable', 'string'],
            'products.*.fault_description' => ['nullable', 'string'],
            'products.*.customer_remark' => ['nullable', 'string'],
            'products.*.received_from' => ['nullable', 'string'],
            'products.*.priority' => ['nullable', 'string'],

            // Single product fallback fields
            'product_name' => ['required_without:products', 'nullable', 'string'],
            'brand' => ['nullable', 'string'],
            'serial_no' => ['nullable', 'string'],
            'power_rating' => ['nullable', 'string'],
            'fault_description' => ['nullable', 'string'],
            'customer_remark' => ['nullable', 'string'],
        ];
    }
}
