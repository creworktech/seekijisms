<?php

namespace App\Http\Requests;

use App\Models\Customer;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class CustomerStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'digits:10', 'regex:/^[6-9]\d{9}$/', 'unique:customers,mobile'],
            'address' => ['required', 'string', 'max:500'],
            'registered_on' => ['nullable', 'date', 'before_or_equal:today'],
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $errors = $validator->errors()->toArray();

        if (isset($errors['mobile'])) {
            $existing = Customer::where('mobile', $this->input('mobile'))->first();
            if ($existing) {
                $errors['mobile'] = ["Already registered to {$existing->name} ({$existing->customer_code})."];

                throw new HttpResponseException(response()->json([
                    'message' => 'This mobile number is already registered.',
                    'errors' => $errors,
                    'existing_customer' => [
                        'id' => $existing->id,
                        'customer_code' => $existing->customer_code,
                        'name' => $existing->name,
                    ],
                ], 422));
            }
        }

        parent::failedValidation($validator);
    }
}
