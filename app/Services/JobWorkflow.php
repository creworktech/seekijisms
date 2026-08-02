<?php

namespace App\Services;

use App\Events\JobTransitioned;
use App\Exceptions\InvalidTransitionException;
use App\Models\Job;
use App\Models\JobEvent;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class JobWorkflow
{
    public function transition(Job $job, string $action, array $data, User $actor, bool $sendWhatsApp = false): Job
    {
        $rule = $this->table()[$job->stage][$action] ?? null;

        if (! $rule) {
            throw new InvalidTransitionException($job, $action, $this->allowedFor($job));
        }

        return DB::transaction(function () use ($job, $action, $data, $actor, $sendWhatsApp) {
            /** @var Job $job */
            $job = Job::lockForUpdate()->find($job->id);

            $currentRules = $this->table()[$job->stage] ?? [];
            if (! isset($currentRules[$action])) {
                throw new InvalidTransitionException($job, $action, $this->allowedFor($job));
            }

            $rule = $currentRules[$action];
            $from = $job->stage;

            $rule['apply']($job, $data);
            $job->save();

            $note = $rule['note']($job, $data);
            if (! empty($data['remarks']) && ! str_contains($note, $data['remarks'])) {
                $note .= " (Remarks: {$data['remarks']})";
            }

            JobEvent::create([
                'job_id'     => $job->id,
                'user_id'    => $actor->id,
                'action'     => $action,
                'from_stage' => $from,
                'to_stage'   => $job->stage,
                'note'       => $note,
                'meta'       => $data,
                'created_at' => now(),
            ]);

            event(new JobTransitioned($job, $action, $sendWhatsApp));

            return $job->fresh(['customer', 'tester', 'technician', 'creator', 'events.user']);
        });
    }

    public function allowedFor(Job $job): array
    {
        return array_keys($this->table()[$job->stage] ?? []);
    }

    protected function getInspectionFee(): float
    {
        return (float) Setting::get('inspection_fee', 250);
    }

    protected function table(): array
    {
        $fee = $this->getInspectionFee();

        return [
            'new' => [
                'assign_tester' => [
                    'to' => 'testing',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'testing';
                        $job->tester_id = $data['tester_id'];
                    },
                    'note' => function (Job $job, array $data) {
                        $tester = User::find($data['tester_id']);
                        $name = $tester ? $tester->name : 'tester';
                        return "Assigned to tester {$name}.";
                    },
                ],
                'cancel' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'completed';
                        $job->outcome = 'cancelled';
                        $job->payable_amount = 0;
                        if (! empty($data['cancel_reason']) || ! empty($data['note']) || ! empty($data['remarks']) || ! empty($data['pend_reason'])) {
                            $job->tester_findings = $data['cancel_reason'] ?? $data['note'] ?? $data['remarks'] ?? $data['pend_reason'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        $reason = $data['cancel_reason'] ?? $data['note'] ?? $data['remarks'] ?? $data['pend_reason'] ?? '';
                        return ! empty($reason) ? "Job cancelled at intake. Reason: {$reason}" : "Job cancelled at intake.";
                    },
                ],
            ],
            'testing' => [
                'ok_no_fault' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'ok_no_fault';
                        $job->payable_amount = $fee;
                        if (! empty($data['tester_findings'])) {
                            $job->tester_findings = $data['tester_findings'];
                        }
                    },
                    'note' => fn () => "Tested: No fault found.",
                ],
                'fault_found' => [
                    'to' => 'approval',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'approval';
                        $job->estimated_budget = $data['estimated_budget'];
                        if (! empty($data['tester_findings'])) {
                            $job->tester_findings = $data['tester_findings'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        return "Fault confirmed. Estimated budget ₹" . number_format((float)$data['estimated_budget'], 2) . ".";
                    },
                ],
                'not_repairable' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'not_repairable';
                        $job->payable_amount = $fee;
                        if (! empty($data['tester_findings'])) {
                            $job->tester_findings = $data['tester_findings'];
                        }
                    },
                    'note' => fn () => "Tested: Item is not repairable.",
                ],
                'cancel' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'cancelled';
                        $job->payable_amount = $fee;
                        if (! empty($data['cancel_reason']) || ! empty($data['tester_findings']) || ! empty($data['remarks'])) {
                            $job->tester_findings = $data['cancel_reason'] ?? $data['tester_findings'] ?? $data['remarks'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        $reason = $data['cancel_reason'] ?? $data['tester_findings'] ?? $data['remarks'] ?? '';
                        return ! empty($reason) ? "Job cancelled during testing. Reason: {$reason}" : "Job cancelled during testing.";
                    },
                ],
            ],
            'approval' => [
                'approve' => [
                    'to' => 'repair',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'repair';
                        $job->approved_amount = $data['approved_amount'];
                        $job->technician_id = $data['technician_id'];
                    },
                    'note' => function (Job $job, array $data) {
                        $tech = User::find($data['technician_id']);
                        $name = $tech ? $tech->name : 'technician';
                        return "Estimate ₹" . number_format((float)$data['approved_amount'], 2) . " approved. Assigned to technician {$name}.";
                    },
                ],
                'not_approved' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'not_approved';
                        $job->payable_amount = $fee;
                    },
                    'note' => fn () => "Estimate not approved by customer.",
                ],
            ],
            'repair' => [
                'reassign_technician' => [
                    'to' => 'repair',
                    'apply' => function (Job $job, array $data) {
                        $job->technician_id = $data['technician_id'];
                    },
                    'note' => function (Job $job, array $data) {
                        $tech = User::find($data['technician_id']);
                        $name = $tech ? $tech->name : 'technician';
                        return "Reassigned to technician {$name}.";
                    },
                ],
                'work_done' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'completed';
                        $job->outcome = 'work_done';
                        $job->final_amount = $data['final_amount'];
                        $job->payable_amount = $data['final_amount'];
                        if (! empty($data['pend_reason']) || ! empty($data['remarks']) || ! empty($data['note'])) {
                            $job->tester_findings = $data['pend_reason'] ?? $data['remarks'] ?? $data['note'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        $note = "Work completed. Final amount ₹" . number_format((float)$data['final_amount'], 2) . ".";
                        $remarks = $data['pend_reason'] ?? $data['remarks'] ?? $data['note'] ?? '';
                        if (! empty($remarks)) {
                            $note .= " Remarks: {$remarks}";
                        }
                        return $note;
                    },
                ],
                'not_repairable' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'not_repairable';
                        $job->payable_amount = $fee;
                    },
                    'note' => fn () => "Repair attempted: Item is not repairable.",
                ],
                'cancel' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'cancelled';
                        $job->payable_amount = $fee;
                        if (! empty($data['cancel_reason']) || ! empty($data['remarks']) || ! empty($data['pend_reason'])) {
                            $job->tester_findings = $data['cancel_reason'] ?? $data['remarks'] ?? $data['pend_reason'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        $reason = $data['cancel_reason'] ?? $data['remarks'] ?? $data['pend_reason'] ?? '';
                        return ! empty($reason) ? "Job cancelled during repair. Reason: {$reason}" : "Job cancelled during repair.";
                    },
                ],
                'mark_pending' => [
                    'to' => 'pending',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'pending';
                        $job->pend_reason = $data['pend_reason'];
                    },
                    'note' => fn (Job $job, array $data) => "Work paused: {$data['pend_reason']}.",
                ],
            ],
            'pending' => [
                'move_to_work' => [
                    'to' => 'repair',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'repair';
                        $job->pend_reason = null;
                    },
                    'note' => function (Job $job, array $data) {
                        $remarks = ! empty($data['remarks']) ? ": {$data['remarks']}" : '';
                        return "Resumed work from pending state{$remarks}.";
                    },
                ],
                'cancel' => [
                    'to' => 'completed',
                    'apply' => function (Job $job, array $data) use ($fee) {
                        $job->stage = 'completed';
                        $job->outcome = 'cancelled';
                        $job->payable_amount = $fee;
                        if (! empty($data['remarks'])) {
                            $job->tester_findings = $data['remarks'];
                        }
                    },
                    'note' => function (Job $job, array $data) {
                        $remarks = ! empty($data['remarks']) ? " (Remarks: {$data['remarks']})" : '';
                        return "Job cancelled while pending{$remarks}.";
                    },
                ],
            ],
            'completed' => [
                'collect_payment' => [
                    'to' => 'ready',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'ready';
                        $job->is_paid = true;
                        $job->payment_mode = $data['payment_mode'];
                        if (isset($data['paid_amount']) && $data['paid_amount'] !== '') {
                            $job->payable_amount = (float) $data['paid_amount'];
                        }
                        $job->paid_at = now();
                    },
                    'note' => function (Job $job, array $data) {
                        $amt = isset($data['paid_amount']) ? (float)$data['paid_amount'] : (float)$job->payable_amount;
                        $remarks = ! empty($data['remarks']) ? " (Remarks: {$data['remarks']})" : '';
                        return "Collected payment of ₹" . number_format($amt, 2) . " via {$data['payment_mode']}{$remarks}.";
                    },
                ],
                'release_unpaid' => [
                    'to' => 'ready',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'ready';
                        $job->is_paid = false;
                    },
                    'note' => function (Job $job, array $data) {
                        $remarks = ! empty($data['remarks']) ? " (Remarks: {$data['remarks']})" : '';
                        return "Released for delivery without payment settlement{$remarks}.";
                    },
                ],
            ],
            'ready' => [
                'deliver' => [
                    'to' => 'delivered',
                    'apply' => function (Job $job, array $data) {
                        $job->stage = 'delivered';
                        $job->delivery_mode = $data['delivery_mode'];
                        $job->delivery_receiver = $data['delivery_receiver'] ?? null;
                        $job->delivery_ref = $data['delivery_ref'] ?? null;
                        $job->out_date = ! empty($data['out_date']) ? Carbon::parse($data['out_date']) : Carbon::today();
                    },
                    'note' => function (Job $job, array $data) {
                        $receiver = ! empty($data['delivery_receiver']) ? " to {$data['delivery_receiver']}" : '';
                        $dateStr = ! empty($data['out_date']) ? " on " . Carbon::parse($data['out_date'])->format('d M Y') : '';
                        return "Delivered via {$data['delivery_mode']}{$receiver}{$dateStr}.";
                    },
                ],
            ],
        ];
    }
}
