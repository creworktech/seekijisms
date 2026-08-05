<?php

namespace App\Http\Requests\Logistics;

use App\Models\Location;
use App\Models\Stop;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class LogisticsUserStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'mobile' => ['required', 'digits:10', 'regex:/^[6-9]\d{9}$/', 'unique:logistics_users,mobile'],
            'password' => ['required', 'string', 'min:6'],
            'location_id' => ['required', 'exists:locations,id'],
            'default_stop_id' => ['nullable', 'exists:stops,id'],
            'is_central' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'mobile.regex' => 'Enter a valid Indian mobile number starting with 6, 7, 8 or 9.',
            'mobile.unique' => 'That mobile number is already registered.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $location = Location::find($this->input('location_id'));

                if (! $location) {
                    return;
                }

                // Rule 13: a location needs at least one active stop before
                // anyone can be assigned to it.
                if (! $location->activeStops()->exists()) {
                    $validator->errors()->add(
                        'location_id',
                        "{$location->name} has no active stops yet. Add a stop before assigning users."
                    );
                }

                // A spoke user works one bus stand in one town, so their
                // default stop has to be local. Staff at the central hub
                // handle traffic to and from every spoke, so they may default
                // to any stop in the network.
                $stopId = $this->input('default_stop_id');

                if ($stopId && ! $location->is_central) {
                    $stop = Stop::find($stopId);

                    if ($stop && $stop->location_id !== $location->id) {
                        $validator->errors()->add('default_stop_id', 'That stop belongs to a different location.');
                    }
                }

                // is_central must agree with the location it points at.
                if ($this->boolean('is_central') && ! $location->is_central) {
                    $validator->errors()->add('is_central', 'Only users at the central location can be central users.');
                }
            },
        ];
    }
}
