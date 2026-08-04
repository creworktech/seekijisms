# Seekoji SMS - Enterprise Developer & Architecture Documentation

Technical architecture deep-dive, database entity relationship specs, Finite State Machine (FSM) handler registry, API routes, and testing suite documentation.

---

## Table of Contents
1. [Technology Stack & Architectural Principles](#1-technology-stack--architectural-principles)
2. [Repository Directory Structure](#2-repository-directory-structure)
3. [Database Schema & Entity Relationships](#3-database-schema--entity-relationships)
4. [Finite State Machine (FSM) Core Specifications](#4-finite-state-machine-fsm-core-specifications)
5. [Atomic Token Generation & Counter Service](#5-atomic-token-generation--counter-service)
6. [API Route Registry & Validation Specs](#6-api-route-registry--validation-specs)
7. [Testing Strategy & Quality Assurance](#7-testing-strategy--quality-assurance)

---

## 1. Technology Stack & Architectural Principles

**Seekoji SMS** is designed as a high-performance modern monolithic web application built with **Laravel 12** and **React 19** via **Inertia.js 2.0**.

| Component | Technology | Purpose & Implementation Details |
| :--- | :--- | :--- |
| **Backend Core** | Laravel 12.x (PHP 8.2+) | Routing, HTTP middleware gates, database transactions, request validation, and CSRF protection. |
| **Monolith Adapter** | Inertia.js 2.0 | Renders server-side responses as client-side page props, eliminating REST serialization boilerplate. |
| **Frontend Core** | React 19 | Modular component tree, local state hooks, custom drawer components, and reactive UI updates. |
| **State Engine** | `App\Services\JobWorkflow` | Finite State Machine (FSM) controlling all 8 stage transitions, outcome updates, and financial rules. |
| **Sequence Service** | `App\Services\CounterService` | Atomic sequence generation for work order tokens and customer IDs via database row-level locks. |
| **Build Engine** | Vite 7.3 + TailwindCSS 4.0 | Hot Module Replacement (HMR) development server and minified production bundles with CSS custom variables. |
| **Database Engine** | MySQL 8.0 / SQLite | Relational storage supporting transactions, JSON columns, soft/hard deletes, and indexed queries. |

---

## 2. Repository Directory Structure

```
seekojisms/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/V1/
│   │   │   │   ├── CustomerController.php       # Customer API & hard delete handler
│   │   │   │   └── JobController.php            # Job CRUD, transition & token preview API
│   │   │   └── Web/
│   │   │       └── WebController.php            # Inertia page controllers
│   │   ├── Requests/
│   │   │   ├── UserStoreRequest.php             # User creation validation (password without confirmation)
│   │   │   ├── UserUpdateRequest.php            # User update validation
│   │   │   ├── JobStoreRequest.php              # Multi-product intake validation
│   │   │   └── JobTransitionRequest.php         # Stage transition payload rules
│   │   └── Resources/
│   │       ├── JobResource.php                  # API transformer for jobs
│   │       └── CustomerResource.php             # API transformer for customers
│   ├── Models/
│   │   ├── Job.php                              # Job entity with stage/outcome casts & scopes
│   │   ├── Customer.php                         # Customer entity with customer_code cast
│   │   ├── JobEvent.php                         # Audit log entity
│   │   └── Counter.php                          # Sequence counter entity
│   └── Services/
│       ├── JobWorkflow.php                      # Finite State Machine transition registry
│       └── CounterService.php                   # Atomic token generator & preview helper
├── database/
│   ├── migrations/                              # Schema definitions for jobs, customers, job_events, counters
│   └── seeders/DemoDataSeeder.php               # Initial seeders for development
├── resources/
│   ├── css/app.css                              # Custom CSS design system, sk-tok, sk-btn, sk-card
│   └── js/
│       ├── Components/
│       │   ├── Common/                          # SearchableCustomerSelect, ConfirmActionModal
│       │   ├── Customers/                       # CreateCustomerModal, ShowCustomerDrawer
│       │   └── Jobs/                            # CreateJobModal, JobTransitionModal, EditJobModal
│       └── Pages/
│           ├── Jobs/ControlCenter.jsx           # JCC split workspace page
│           ├── Jobs/Index.jsx                  # All Jobs drawer & list workspace
│           ├── Customers/Index.jsx              # Customer directory & delete modal
│           ├── Accounts/Index.jsx               # Accounts settlement dashboard
│           ├── Reports/Index.jsx                # Reports & CSV/Print exports
│           └── Users/Index.jsx                  # Staff account management
└── tests/
    └── Feature/
        ├── CustomerTest.php                     # Customer duplicate check & admin delete tests
        └── JobWorkflowTest.php                  # FSM stage transition & multi-intake test suite
```

---

## 3. Database Schema & Entity Relationships

### 3.1 Entity Relationships & Foreign Keys

| Table Name | Primary Key | Foreign Key Relationships | Key Indexed Columns |
| :--- | :--- | :--- | :--- |
| `users` | `id` (BIGINT) | Belongs to Roles (Spatie Permission) | `email` (UNIQUE) |
| `customers` | `id` (BIGINT) | Has Many `jobs` | `customer_code` (UNIQUE), `mobile` (INDEX) |
| `jobs` | `id` (BIGINT) | Belongs to `customer_id`, `technician_id`, `created_by` | `token_no` (UNIQUE), `stage` (INDEX), `outcome` (INDEX) |
| `job_events` | `id` (BIGINT) | Belongs to `job_id`, `user_id` | `job_id`, `created_at` |
| `counters` | `key` (VARCHAR) | None (Atomic counter lookup) | `key` (PRIMARY) |

### 3.2 Field Specifications: `jobs` Table

| Column Name | Data Type | Nullability | Description & Business Rules |
| :--- | :--- | :--- | :--- |
| `token_no` | VARCHAR(50) | NOT NULL | Auto-generated token string (e.g. `SES1`). |
| `product_name` | VARCHAR(255) | NOT NULL | Equipment title (e.g. ACGT, VFD Drive 45kW). |
| `brand` | VARCHAR(255) | NULLABLE | Brand/Make manufacturer (e.g. ABB, Siemens, LG, Schneider). |
| `serial_no` | VARCHAR(255) | NULLABLE | Hardware serial identification number. |
| `power_rating` | VARCHAR(100) | NULLABLE | Power specification (e.g. 15 HP, 415V). |
| `stage` | ENUM(...) | NOT NULL | Current stage: `new`, `testing`, `approval`, `repair`, `pending`, `completed`, `ready`, `delivered`. |
| `outcome` | ENUM(...) | NULLABLE | Diagnostic/repair status: `ok_no_fault`, `not_repairable`, `not_approved`, `work_done`, `cancelled`. |
| `estimated_budget` | DECIMAL(10,2) | NULLABLE | Budget estimated during testing for customer approval. |
| `approved_amount` | DECIMAL(10,2) | NULLABLE | Customer-approved repair budget cap. |
| `final_amount` | DECIMAL(10,2) | NULLABLE | Final invoice total entered by technician at work completion. |
| `payable_amount` | DECIMAL(10,2) | NULLABLE | Actual receivable amount. Set to `0.00` when estimate rejected or 0 fee. |
| `is_paid` | BOOLEAN | DEFAULT FALSE | Settlement flag. True when payment is recorded or zero due. |

---

## 4. Finite State Machine (FSM) Core Specifications

### Complete Transition Handler Registry

| Current Stage | Action Trigger | Target Stage | Set Outcome | Financial & Field Rules |
| :--- | :--- | :--- | :--- | :--- |
| `new` | `assign_tester` | `testing` | *None* | Assigns `tester_id`. Records note. |
| `new` | `cancel` | `completed` | `cancelled` | Sets `payable_amount = 0`. Job terminated at intake. |
| `testing` | `ok_no_fault` | `completed` | `ok_no_fault` | Sets `payable_amount = inspection_fee` (or 0). |
| `testing` | `fault_found` | `approval` | *None* | Requires `estimated_budget >= 0`. Stores `tester_findings`. |
| `testing` | `not_repairable` | `completed` | `not_repairable` | Sets `payable_amount = inspection_fee`. |
| `approval` | `approve` | `repair` | *None* | Requires `approved_amount` and `technician_id`. |
| `approval` | `not_approved` | `completed` | `not_approved` | Sets `payable_amount = inspection_fee` (0 if waived). UI shows NO AMOUNT DUE. |
| `repair` | `work_done` | `completed` | `work_done` | Requires `final_amount`. Sets `payable_amount = final_amount`. |
| `repair` | `hold` | `pending` | *None* | Stores `pend_reason` (waiting for parts). |
| `pending` | `resume` | `repair` | *None* | Resumes active repair work. |
| `completed` | `collect_payment` | `ready` | *None* | Sets `is_paid = true`, records `payment_mode` & `paid_at`. |
| `completed` | `release_unpaid` | `ready` | *None* | Leaves `is_paid = false`. Moves to ready for delivery with dues. |
| `ready` | `deliver` | `delivered` | *None* | Requires `received_by`. Terminal stage transition. |

---

## 5. Atomic Token Generation & Counter Service

```php
// App\Services\CounterService.php
public static function generateNextToken(): string
{
    return DB::transaction(function () {
        $prefix = Setting::get('token_prefix', 'SES');
        $counter = Counter::where('key', 'job_token')->lockForUpdate()->first();

        if (! $counter) {
            $counter = Counter::create(['key' => 'job_token', 'value' => 0]);
        }

        $counter->value += 1;
        $counter->save();

        return $prefix . $counter->value;
    });
}
```

---

## 6. API Route Registry & Validation Specs

| Method | Route Endpoint | Request Class | Action / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/jobs/token-preview` | `auth:sanctum` | Returns JSON `{ next_token: "SES1", range: "SES1 - SES3" }`. |
| `POST` | `/api/v1/jobs` | `JobStoreRequest` | Validates customer & product array. Creates jobs in DB transaction. |
| `POST` | `/api/v1/jobs/{job}/transition` | `JobTransitionRequest` | Executes FSM transition action, updates state & audit event log. |
| `DELETE` | `/api/v1/jobs/{job}` | `role:admin` | Executes `$job->forceDelete()` to permanently purge record. |
| `DELETE` | `/api/v1/customers/{customer}` | `role:admin` | Executes `$customer->forceDelete()` for customer purging. |

---

## 7. Testing Strategy & Quality Assurance

```bash
# Execute Full PHPUnit Test Suite (30 Tests Passed, 116 Assertions)
php artisan test

# Build Minified Production Assets
npm run build
```

---

## 8. Production VPS Deployment & Operations Guide

### 8.1 Production Server Credentials & Connection Info

| Parameter | Configuration Value | Description / Usage |
| :--- | :--- | :--- |
| **Server IP Address** | `72.61.236.77` | Host VPS IP Address |
| **SSH Connection User** | `deploy` | SSH User: `ssh deploy@72.61.236.77` |
| **VPS Console Password** | `123456` | Web console login password for `deploy` user |
| **Admin Mail & Password** | `eseekoji@gmail.com` / `Seekoji@123` | System administrator login credentials |
| **Production Site Root** | `/var/www/service.seekojielectric.com` | Application root directory on VPS |
| **Database Name** | `seekoji` | Production MySQL Database |
| **Database Credentials** | `seekoji` / `Seekoji@123` | MySQL Database User & Password |

### 8.2 Operational & Management Command Reference

| Management Task | Shell Command Line | Operational Description |
| :--- | :--- | :--- |
| **Connect to VPS** | `ssh deploy@72.61.236.77` | Establishes secure SSH terminal session. |
| **Navigate to Site Path** | `cd /var/www/service.seekojielectric.com` | Changes working directory to application root. |
| **Deploy New Code** | `./deploy.sh` | Pulls latest repository changes, builds assets, and runs migrations. |
| **Watch Live Logs** | `tail -f storage/logs/laravel.log` | Streams real-time application error logs (`Ctrl+C` to exit). |
| **Queue Worker Status** | `sudo supervisorctl status` | Inspects Supervisor background job queue worker status. |
| **Restart Queue Worker** | `sudo supervisorctl restart seekoji-worker:*` | Restarts all background queue worker instances. |
| **MySQL Console** | `mysql -u seekoji -p` | Opens production MySQL database terminal (Enter `Seekoji@123`). |
| **Restart PHP-FPM** | `sudo systemctl restart php8.3-fpm` | Restarts PHP 8.3 FPM process manager. |

