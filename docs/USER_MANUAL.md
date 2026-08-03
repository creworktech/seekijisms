# Seekoji SMS - User Manual & Operational Guide

Comprehensive Operational Handbook for Intake Coordinators, Technicians, Accounts Staff, and Administrators.

---

## Table of Contents
1. [Welcome to Seekoji SMS](#1-welcome-to-seekoji-sms)
2. [Interface Layout & Staff Account Setup](#2-interface-layout--staff-account-setup)
3. [Customer Registration & Lookup](#3-customer-registration--lookup)
4. [Job Intake & Token Pre-Generation](#4-job-intake--token-pre-generation)
5. [Job Control Center (JCC) - 8 Workflow Stages Guide](#5-job-control-center-jcc---8-workflow-stages-guide)
6. [Financial Dues & Payment Status Explanation](#6-financial-dues--payment-status-explanation)
7. [Reports & Data Export](#7-reports--data-export)

---

## 1. Welcome to Seekoji SMS

**Seekoji SMS** is an enterprise-grade Service Management System designed specifically for electrical equipment repair centers. Whether you manage single-item walk-in customers or bulk equipment intake from industrial clients, Seekoji SMS simplifies job tracking, diagnostics, budget approvals, repair workflows, and financial settlements.

### User Roles & Access Privileges

| User Role | Primary Responsibilities | Accessible Modules & Action Scope |
| :--- | :--- | :--- |
| **Admin** | Overall business oversight, financial settlements, staff creation, job & customer deletion. | Access to ALL pages (`Dashboard`, `JCC`, `All Jobs`, `Delivery`, `Customers`, `Accounts`, `Reports`, `Users`, `Settings`). Only role allowed to delete records. |
| **Intake Coordinator** | Customer registration, equipment intake, token receipt issuing, customer handover. | Access to `Job Intake Modal`, `Job Control Center`, `Customers Directory`, and `Delivery`. Cannot alter financial settings or delete records. |
| **Technician / Tester** | Equipment testing, technical fault reporting, repair work execution, final bill entry. | Mainly operates inside `Under Testing` and `Under Repair` stages. Enters diagnostic findings and required repair budgets. |

---

## 2. Interface Layout & Staff Account Setup

### 2.1 Navigation Bar & Main Views
- **Dashboard:** Executive summary tiles showing active job counts, revenue stats, and stage distribution charts.
- **Job Control Center (JCC):** Interactive 8-stage Kanban workspace designed for daily operations.
- **All Jobs:** Tabular view with advanced multi-filter search, sorting, and job drawer.
- **Delivery:** Dispatch desk list showing items ready for customer collection.
- **Customers:** Customer database with profile drawers, history logs, and delete options.
- **Accounts:** Financial ledger tracking collected cash/UPI revenue and pending customer dues.
- **Reports:** Exportable analytics reports (CSV and printable PDF work order receipts).
- **Users:** Staff user account management (Admin only).
- **Settings:** Configure token prefixes (`SES`), customer prefixes (`C`), and inspection fees.

### 2.2 Creating Staff User Accounts (Admin Only)
1. Navigate to **Users** menu in sidebar.
2. Click **+ Add New User**.
3. Fill in Name, Email, Mobile Number, and Select Role (`Admin`, `Intake Coordinator`, or `Technician`).
4. Enter password in a single field (password confirmation field is removed for simplicity).
5. Click **Save User**. Staff member can log in immediately.

---

## 3. Customer Registration & Lookup

Every customer profile is assigned a permanent system ID (e.g. `ID00001`). System verifies mobile numbers in real time to prevent duplicate profiles.

### 3.1 Step-by-Step Customer Creation
1. Click **Customers** in sidebar and click **+ Add Customer** (or click *New Customer* inside Intake Modal).
2. Type 10-digit mobile number:
   - If mobile exists: System displays *"Customer Already Registered"* and auto-fills details.
   - If mobile is new: System enables fields for Name, Email, Address, and City.
3. Fill in Customer Name and click **Save Customer**.
4. Customer receives permanent customer code (e.g. `C00002`).

---

## 4. Job Intake & Token Pre-Generation

The **Job Intake Modal** handles both single equipment intake and multi-product bulk intake.

### 4.1 Pre-Generated Token Sequence Feature
When you open the Intake Modal, Seekoji SMS previews exact token numbers assigned to each product (e.g., `Token: #SES1`, `Token: #SES2`) *before* you save to the database.

1. Click top right **NEW JOBS** button.
2. Select or create customer using searchable dropdown.
3. For Product 1: Enter Product Name (e.g. ACGT), Brand/Make (e.g. LG), Serial Number, Power Rating, and Customer Reported Fault. Notice pre-assigned token badge `Token: #SES1`.
4. If customer brought multiple units, click **+ Add Another Product**. Product 2 automatically gets badge `Token: #SES2`.
5. Click **Create Work Orders**. All work orders save under consecutive token numbers in one click!

---

## 5. Job Control Center (JCC) - 8 Workflow Stages Guide

The **Job Control Center (JCC)** divides workflow into 8 clear sequential stages:

| Stage Name | What It Means | Action Required & Next Steps |
| :--- | :--- | :--- |
| **1. NEW JOBS** | Equipment newly logged at reception desk. | Review reported fault, select tester, and click `Assign Tester`. (Or click `Cancel Job` if customer cancels at intake). |
| **2. UNDER TESTING** | Tester diagnosing hardware on bench. | Input *Technical Findings*: Choose `No Fault Found` (Completed), `Fault Confirmed` (enter budget -> Approval), or `Not Repairable` (Completed). |
| **3. AWAITING APPROVAL** | Budget presented to customer. | Call customer: Click `Approve` (enter budget & tech -> Repair) or `Estimate Rejected` (Completed -> NO AMOUNT DUE). |
| **4. UNDER REPAIR** | Technician actively repairing. | Click `Work Done` (enter final bill -> Completed) or `Hold / Pending` (Pending). |
| **5. PENDING** | Paused (waiting for spare parts). | Once parts arrive, click `Resume Repair` to return job to Under Repair. |
| **6. COMPLETED / PAYMENT** | Repair finished or estimate rejected. | Review bill: Click `Collect Payment & Release` (Cash/UPI -> Ready for Delivery) or `Release to Delivery` (if 0 due). |
| **7. READY FOR DELIVERY** | Equipment ready at dispatch desk. | Verify customer pickup and click `Handover to Customer` (Delivered). |
| **8. DELIVERED** | Equipment returned to customer. | Archived completed job record with full audit history. |

---

## 6. Financial Dues & Payment Status Explanation

- **PAID (₹X,XXX)**: Repair amount or fee collected and settled via Cash, UPI, or Bank Transfer.
- **UNPAID (₹X,XXX)**: Final bill or fee remains uncollected.
- **NO AMOUNT DUE (₹0)**: Automatically displayed when estimate was rejected by customer or no repair fee applies.

---

## 7. Reports & Data Export

- **CSV Export**: Click *Export CSV* to download spreadsheet of work orders.
- **Print Summaries**: Click *Print Summary* to print physical paper work order receipt.
