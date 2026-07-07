<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class PromoteAdminCommand extends Command
{
    protected $signature = 'admin:promote {email : The user email to promote}';

    protected $description = 'Promote a user to admin role';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('User not found.');

            return self::FAILURE;
        }

        $user->update(['role' => 'admin', 'status' => 'active']);

        $this->info("{$user->email} is now an admin.");

        return self::SUCCESS;
    }
}
