<?php

namespace App\Exceptions;

use App\Models\Dispatch;
use Exception;
use Illuminate\Http\JsonResponse;

/**
 * Thrown when a dispatch status change is not permitted. Carries the HTTP
 * status the API should answer with, so controllers never have to map
 * domain failures onto response codes themselves.
 */
class DispatchTransitionException extends Exception
{
    public function __construct(
        string $message,
        private readonly int $status = 409,
    ) {
        parent::__construct($message);
    }

    public static function alreadyFinalised(Dispatch $dispatch): self
    {
        return new self(
            "Dispatch {$dispatch->reference_no} is already marked {$dispatch->status->label()} and cannot change again.",
            409
        );
    }

    public static function senderCannotChangeStatus(): self
    {
        return new self('The sender can never change a dispatch status. Only the receiver can.', 403);
    }

    public static function notAuthorisedToReceive(): self
    {
        return new self('Only a user at the receiving location may confirm this dispatch.', 403);
    }

    public static function notEditable(): self
    {
        return new self('A dispatch can only be edited by its sender while it is still pending.', 409);
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
