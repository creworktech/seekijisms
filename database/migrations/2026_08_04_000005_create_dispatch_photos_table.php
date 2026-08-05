<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispatch_id')->constrained('dispatches')->cascadeOnDelete();
            $table->enum('type', ['bus', 'package', 'receipt']);
            $table->string('path', 255);
            $table->string('thumb_path', 255)->nullable();
            $table->timestamps();

            $table->index('dispatch_id');
            $table->index(['dispatch_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_photos');
    }
};
