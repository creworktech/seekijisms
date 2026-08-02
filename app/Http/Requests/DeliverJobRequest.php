<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeliverJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery_mode' => ['required', 'in:bus,courier,self'],
            'delivery_receiver' => ['required', 'string', 'max:120'],
            'delivery_ref' => ['nullable', 'string', 'max:80'],
            'out_date' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'send_whatsapp' => ['nullable', 'boolean'],
        ];
    }
}
