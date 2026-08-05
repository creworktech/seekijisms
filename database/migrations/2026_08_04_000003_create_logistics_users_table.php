<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('logistics_users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);

            // Mobile number is the login identity. The UNIQUE index is the duplicate
            // guard — application logic never decides this on its own.
            $table->string('mobile', 10)->unique();
            $table->string('password');

            $table->foreignId('location_id')->constrained('locations')->restrictOnDelete();
            $table->foreignId('default_stop_id')->nullable()->constrained('stops')->nullOnDelete();

            $table->boolean('is_central')->default(false);
            $table->boolean('is_admin')->default(false);
            $table->boolean('is_active')->default(true);

            $table->string('fcm_token', 255)->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index('location_id');
            $table->index(['is_central', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_users');
    }
};
