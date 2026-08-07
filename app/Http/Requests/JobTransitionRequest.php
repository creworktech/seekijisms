<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class JobTransitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('action')) {
            if ($this->has('delivery_mode')) {
                $this->merge(['action' => 'deliver']);
            } elseif ($this->has('payment_mode')) {
                $this->merge(['action' => 'collect_payment']);
            } elseif ($this->has('final_amount')) {
                $this->merge(['action' => 'work_done']);
            } elseif ($this->has('approved_amount')) {
                $this->merge(['action' => 'approve']);
            } elseif ($this->has('estimated_budget')) {
                $this->merge(['action' => 'fault_found']);
            } elseif ($this->has('tester_id')) {
                $this->merge(['action' => 'assign_tester']);
            } elseif ($this->has('pend_reason')) {
                $this->merge(['action' => 'mark_pending']);
            }
        }
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'string'],
            'tester_id' => [
                'required_if:action,assign_tester',
                'nullable',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $user = User::find($value);
                        if (! $user || (! $user->hasRole('tester') && ! $user->hasRole('admin'))) {
                            $fail('The selected tester must hold the tester role.');
                        }
                    }
                },
            ],
            'technician_id' => [
                'required_if:action,approve,reassign_technician',
                'nullable',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $user = User::find($value);
                        if (! $user || (! $user->hasRole('technician') && ! $user->hasRole('admin'))) {
                            $fail('The selected technician must hold the technician role.');
                        }
                    }
                },
            ],
            'estimated_budget' => ['required_if:action,fault_found', 'nullable', 'numeric', 'min:0', 'max:9999999'],
            'approved_amount' => ['required_if:action,approve', 'nullable', 'numeric', 'min:0'],
            'final_amount' => ['required_if:action,work_done', 'nullable', 'numeric', 'min:0'],
            'paid_amount' => [
                'nullable',
                'numeric',
                'min:0.01',
                function ($attribute, $value, $fail) {
                    if ($this->input('action') !== 'collect_payment') {
                        return;
                    }

                    /** @var \App\Models\Job|null $job */
                    $job = $this->route('job');
                    $due = $job?->dueAmount();

                    if ($due !== null && (float) $value > $due + 0.01) {
                        $fail('Collected amount cannot exceed the ₹' . number_format($due, 2) . ' still due.');
                    }
                },
            ],
            'payment_mode' => ['required_if:action,collect_payment', 'nullable', 'in:cash,upi,bank,waived'],
            'pend_reason' => ['required_if:action,mark_pending', 'nullable', 'string', 'max:255'],
            'delivery_mode' => ['required_if:action,deliver', 'nullable', 'in:bus,courier,self'],
            'delivery_receiver' => ['required_if:action,deliver', 'nullable', 'string', 'max:120'],
            'delivery_ref' => ['nullable', 'string', 'max:80'],
            'out_date' => ['nullable', 'date'],
            'tester_findings' => ['nullable', 'string', 'max:1000'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'send_whatsapp' => ['nullable', 'boolean'],
        ];
    }
}
