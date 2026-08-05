<?php

namespace App\Http\Requests\Logistics;

use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class DispatchStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof LogisticsUser;
    }

    public function rules(): array
    {
        return [
            // Idempotency key from the mobile offline queue. Generated once
            // when the dispatch is queued and reused on every retry.
            'client_uuid' => ['nullable', 'uuid'],
            'receiver_id' => ['required', 'exists:logistics_users,id'],
            'from_stop_id' => ['required', 'exists:stops,id'],
            'to_stop_id' => ['required', 'exists:stops,id'],
            'item_description' => ['required', 'string', 'min:3', 'max:255'],
            'quantity' => ['required', 'integer', 'min:1'],
            'bus_number' => ['required', 'string', 'max:30'],
            'driver_mobile' => ['nullable', 'digits:10'],
            'receiver_mobile' => ['nullable', 'digits:10'],
            'bus_reach_time' => ['required', 'date_format:H:i'],
            'bus_leave_time' => ['required', 'date_format:H:i'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'bus_photos' => ['required', 'array', 'min:1', 'max:2'],
            'bus_photos.*' => ['image', 'mimes:jpeg,jpg,png', 'max:2048'],
            'package_photos' => ['required', 'array', 'min:1', 'max:2'],
            'package_photos.*' => ['image', 'mimes:jpeg,jpg,png', 'max:2048'],
        ];
    }

    /**
     * The two time columns are named after an earlier reading of the spec.
     * Both describe the bus at the PICKUP stand, so validation errors should
     * say so rather than repeat the column name.
     */
    public function attributes(): array
    {
        return [
            'bus_reach_time' => 'bus in time',
            'bus_leave_time' => 'bus out time',
            'from_stop_id' => 'pickup stop',
            'to_stop_id' => 'drop stop',
            'receiver_id' => 'receiver',
        ];
    }

    /**
     * Business rules 2 to 5. These are relationships between fields, so they
     * live here rather than in the column rules above.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var LogisticsUser $sender */
                $sender = $this->user();

                $receiver = LogisticsUser::find($this->input('receiver_id'));

                if (! $receiver) {
                    return;
                }

                $this->validateReceiver($validator, $sender, $receiver);
                $this->validateStops($validator, $sender, $receiver);
            },
        ];
    }

    protected function validateReceiver(Validator $validator, LogisticsUser $sender, LogisticsUser $receiver): void
    {
        if (! $receiver->is_active) {
            $validator->errors()->add('receiver_id', 'That user is deactivated and cannot receive dispatches.');

            return;
        }

        // Rule 2: a spoke user may only send to the central hub.
        if ($sender->isSpoke() && ! $receiver->is_central) {
            $validator->errors()->add('receiver_id', 'You can only send packages to the Ranchi hub.');
        }

        // Rule 3: a central user may only send to a non-central active user.
        if ($sender->is_central && $receiver->is_central) {
            $validator->errors()->add('receiver_id', 'The hub can only send packages to a spoke location.');
        }
    }

    protected function validateStops(Validator $validator, LogisticsUser $sender, LogisticsUser $receiver): void
    {
        $fromStop = Stop::find($this->input('from_stop_id'));
        $toStop = Stop::find($this->input('to_stop_id'));

        // Rule 4: the pickup stop must be in the sender's own location.
        if ($fromStop && $fromStop->location_id !== $sender->location_id) {
            $validator->errors()->add('from_stop_id', 'That stop does not belong to your location.');
        }

        // Rule 5: the drop stop must be in the receiver's location.
        if ($toStop && $toStop->location_id !== $receiver->location_id) {
            $validator->errors()->add('to_stop_id', "That stop does not belong to the receiver's location.");
        }
    }
}
