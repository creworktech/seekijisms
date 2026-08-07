<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JobResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'token_no' => $this->token_no,
            'customer_id' => $this->customer_id,
            'customer' => $this->relationLoaded('customer') && $this->customer ? (new CustomerResource($this->customer))->resolve() : null,
            'product_name' => $this->product_name,
            'brand' => $this->brand,
            'serial_no' => $this->serial_no,
            'power_rating' => $this->power_rating,
            'fault_description' => $this->fault_description,
            'customer_remark' => $this->customer_remark,
            'received_from' => $this->received_from,
            'priority' => $this->priority,
            'stage' => $this->stage,
            'outcome' => $this->outcome,
            'tester_id' => $this->tester_id,
            'tester' => $this->relationLoaded('tester') && $this->tester ? (new UserResource($this->tester))->resolve() : null,
            'technician_id' => $this->technician_id,
            'technician' => $this->relationLoaded('technician') && $this->technician ? (new UserResource($this->technician))->resolve() : null,
            'tester_findings' => $this->tester_findings,
            'estimated_budget' => $this->estimated_budget ? (float) $this->estimated_budget : null,
            'approved_amount' => $this->approved_amount ? (float) $this->approved_amount : null,
            'final_amount' => $this->final_amount ? (float) $this->final_amount : null,
            'payable_amount' => $this->payable_amount !== null ? (float) $this->payable_amount : null,
            'paid_amount' => (float) $this->paid_amount,
            'due_amount' => $this->dueAmount(),
            'payment_status' => $this->paymentStatus(),
            'is_paid' => (bool) $this->is_paid,
            'payment_mode' => $this->payment_mode,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'payments' => $this->relationLoaded('payments')
                ? $this->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'amount' => (float) $p->amount,
                    'payment_mode' => $p->payment_mode,
                    'remarks' => $p->remarks,
                    'collected_by' => $p->relationLoaded('collector') ? $p->collector?->name : null,
                    'collected_at' => $p->collected_at?->toIso8601String(),
                ])->values()
                : [],
            'pend_reason' => $this->pend_reason,
            'delivery_mode' => $this->delivery_mode,
            'delivery_receiver' => $this->delivery_receiver,
            'delivery_ref' => $this->delivery_ref,
            'in_date' => $this->in_date?->format('Y-m-d'),
            'out_date' => $this->out_date?->format('Y-m-d'),
            'created_by' => $this->created_by,
            'creator' => $this->relationLoaded('creator') && $this->creator ? (new UserResource($this->creator))->resolve() : null,
            'events' => $this->relationLoaded('events') && $this->events ? JobEventResource::collection($this->events)->resolve() : [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
