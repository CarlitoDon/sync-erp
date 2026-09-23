# Domain Context Glossary

This file serves as the strict, canonical glossary for the domain language used in this project.
If a word is defined here, do not use synonyms.

## Core Concepts

*   **Tenant**: An organization or business entity that uses an instance of the Sync ERP system. Sync ERP is a multi-tenant platform. There is no "internal" or default proprietary tenant (such as the legacy "Santi Living").
*   **WhatsApp Bot Connector**: The Baileys-based daemon service responsible for managing the WhatsApp device session, transmitting transaction and order notifications, and capturing inbound messaging events.
*   **WhatsApp Bot Status**: A singleton state entity in the database that persists the connector's connectivity status, pairing QR, runtime error traces, and operational alert states.
*   **Hermes Rara**: An autonomous AI agent operating as the digital sales and customer support assistant for rental operations, with escalation channels to human administrators via Telegram.
*   **Rental Order Draft**: An initial rental booking created in the DRAFT state that records customer identity, item selections, delivery schedule/hours, and logistics address/notes prior to payment or unit assignment. Payment method selection is strictly excluded from this phase.
*   **Company Payment Method**: A configured payment receiving channel (e.g. Bank Transfer, QRIS, Cash COD) owned by a tenant and explicitly mapped to a General Ledger Chart of Accounts (COA) entry. Applied during order confirmation and payment verification to post accurate accounting records.
*   **Optional Rental Deposit**: A discretionary security deposit enabled on a per-order basis when an administrator explicitly flags an order as requiring a security guarantee.
