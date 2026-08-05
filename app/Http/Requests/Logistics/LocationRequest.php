<?php

namespace App\Http\Requests\Logistics;

use App\Models\Location;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $locationId = $this->route('location')?->id;

        return [
            'name' => [
                'required', 'string', 'min:2', 'max:80',
                Rule::unique('locations', 'name')->ignore($locationId)->whereNull('deleted_at'),
            ],
            'is_central' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->boolean('is_central')) {
                    return;
                }

                // Exactly one location may be central.
                $existing = Location::query()
                    ->central()
                    ->when($this->route('location'), fn ($q, $location) => $q->whereKeyNot($location->id))
                    ->first();

                if ($existing) {
                    $validator->errors()->add(
                        'is_central',
                        "{$existing->name} is already the central hub. Only one location can be central."
                    );
                }
            },
        ];
    }
}
