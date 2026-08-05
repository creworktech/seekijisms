<?php

namespace App\Http\Requests\Logistics;

use App\Models\LogisticsUser;
use Illuminate\Foundation\Http\FormRequest;

class DispatchReceiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof LogisticsUser;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'in:received,not_received'],
            'note' => ['required_if:action,not_received', 'nullable', 'string', 'min:5', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'receipt_photo' => ['nullable', 'image', 'mimes:jpeg,jpg,png', 'max:2048'],
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
