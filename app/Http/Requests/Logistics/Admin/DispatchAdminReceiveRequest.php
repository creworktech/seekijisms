<?php

namespace App\Http\Requests\Logistics\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * An SMS admin confirming (or reporting non-receipt of) a dispatch on
 * behalf of whichever logistics user physically has the package in front
 * of them. acting_user_id is who that is — DispatchService::assertMayConfirm
 * still enforces that they're active and either the named receiver or a
 * colleague at the same location, exactly as it does for a mobile confirm.
 */
class DispatchAdminReceiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->is_active && $user->can('users.manage');
    }

    public function rules(): array
    {
        return [
            'acting_user_id' => ['required', 'exists:logistics_users,id'],
            'action' => ['required', 'in:received,not_received'],
            'note' => ['required_if:action,not_received', 'nullable', 'string', 'min:5', 'max:500'],
            'receipt_photo' => ['nullable', 'image', 'mimes:jpeg,jpg,png', 'max:2048'],
        ];
    }

    public function attributes(): array
    {
        return [
            'acting_user_id' => 'confirming user',
        ];
    }

    public function messages(): array
    {
        return [
            'note.required_if' => 'A reason is required when a package is not received.',
            'note.min' => 'Please give a reason of at least 5 characters.',
        ];
    }
}
