<?php

namespace App\Exceptions;

use App\Models\Job;
use Exception;
use Illuminate\Http\JsonResponse;

class InvalidTransitionException extends Exception
{
    protected Job $job;
    protected string $action;
    protected array $allowedActions;

    public function __construct(Job $job, string $action, array $allowedActions = [])
    {
        $this->job = $job;
        $this->action = $action;
        $this->allowedActions = $allowedActions;

        $allowedStr = implode(', ', $allowedActions);
        $message = "Cannot perform '{$action}' on a job in stage '{$job->stage}'.";

        parent::__construct($message, 409);
    }

    public function getJob(): Job
    {
        return $this->job;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function getAllowedActions(): array
    {
        return $this->allowedActions;
    }

    public function render(): JsonResponse
    {
        $allowedStr = implode(', ', $this->allowedActions);

        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                'action' => ["Allowed actions here: {$allowedStr}."]
            ]
        ], 409);
    }
}
