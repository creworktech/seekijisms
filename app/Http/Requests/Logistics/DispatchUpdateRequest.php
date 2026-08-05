<?php

namespace App\Http\Requests\Logistics;

use App\Models\Dispatch;
use App\Models\DispatchPhoto;
use App\Models\LogisticsUser;
use Illuminate\Contracts\Validation\Validator;

/**
 * Edits are only accepted while the dispatch is pending and only from its
 * sender — DispatchService re-checks that under a row lock. Photos here are
 * additions, so the per-type ceiling counts what is already stored.
 */
class DispatchUpdateRequest extends DispatchStoreRequest
{
    /**
     * Ownership is settled before any field is validated. Otherwise the
     * payload would be checked against the wrong user's location and a
     * non-sender would get a confusing 422 instead of a plain 403.
     *
     * Whether the dispatch is still pending is re-checked by DispatchService
     * under a row lock, which is the only race-free place to decide it.
     */
    public function authorize(): bool
    {
        $dispatch = $this->route('dispatch');
        $user = $this->user();

        if (! $user instanceof LogisticsUser || ! $dispatch instanceof Dispatch) {
            return false;
        }

        return $dispatch->sender_id === $user->id;
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'bus_photos' => ['nullable', 'array', 'max:2'],
            'package_photos' => ['nullable', 'array', 'max:2'],
        ]);
    }

    public function after(): array
    {
        return array_merge(parent::after(), [
            function (Validator $validator) {
                /** @var Dispatch|null $dispatch */
                $dispatch = $this->route('dispatch');

                if (! $dispatch instanceof Dispatch) {
                    return;
                }

                foreach ([DispatchPhoto::TYPE_BUS, DispatchPhoto::TYPE_PACKAGE] as $type) {
                    $field = $type . '_photos';
                    $incoming = count((array) $this->file($field, []));

                    if ($incoming === 0) {
                        continue;
                    }

                    $limit = DispatchPhoto::MAX_PER_TYPE[$type];
                    $existing = $dispatch->photos()->where('type', $type)->count();

                    if ($existing + $incoming > $limit) {
                        $remaining = max(0, $limit - $existing);

                        $validator->errors()->add($field, $remaining === 0
                            ? "This dispatch already has the maximum of {$limit} {$type} photos."
                            : "You can add at most {$remaining} more {$type} photo(s).");
                    }
                }
            },
        ]);
    }
}
