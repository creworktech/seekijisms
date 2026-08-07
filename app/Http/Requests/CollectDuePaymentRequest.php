<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Settling a balance that's still owed, independent of whatever stage the
 * job is currently sitting in — a customer might come back to pay off a
 * partial payment well after the item was delivered.
 */
class CollectDuePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_mode' => ['required', 'in:cash,upi,bank,waived'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var \App\Models\Job|null $job */
                $job = $this->route('job');
                $due = $job?->dueAmount();

                if ($due === null || $due <= 0) {
                    $validator->errors()->add('amount', 'This job has no outstanding balance to collect.');

                    return;
                }

                $amount = (float) $this->input('amount');
                if ($amount > $due + 0.01) {
                    $validator->errors()->add('amount', 'Collected amount cannot exceed the ₹' . number_format($due, 2) . ' still due.');
                }
            },
        ];
    }
}
