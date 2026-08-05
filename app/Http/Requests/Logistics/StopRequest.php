<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StopRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $stop = $this->route('stop');
        $locationId = $this->input('location_id', $stop?->location_id);

        return [
            'location_id' => ['required', 'exists:locations,id'],
            'name' => [
                'required', 'string', 'min:2', 'max:120',
                // Stop names are unique per location, not globally.
                Rule::unique('stops', 'name')
                    ->where(fn ($query) => $query->where('location_id', $locationId))
                    ->ignore($stop?->id)
                    ->whereNull('deleted_at'),
            ],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'That stop already exists at this location.',
        ];
    }
}
