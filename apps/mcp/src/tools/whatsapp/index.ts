/**
 * WhatsApp Sales Bot Tools Registry
 */
import type { ToolSpec } from '../../types.js';
import { companyIdProp } from '../_helpers.js';
import { handleWhatsappSendMessage, handleWhatsappSendQris } from './send-message.js';
import { handleEstimateDeliveryFee } from './delivery-fee.js';
import { handleSetCustomerNote } from './customer-note.js';
import { handleEscalateToOwner, handleGetLastEscalatedLead } from './escalation.js';
import { handleManageCustomerWhitelist } from './whitelist.js';
import { handleTakeOverConversation, handleReturnToBot } from './session-control.js';
import { handleRentalOrderAutoBookLead } from './auto-book.js';

export * from './redis-client.js';
export * from './send-message.js';
export * from './delivery-fee.js';
export * from './customer-note.js';
export * from './escalation.js';
export * from './whitelist.js';
export * from './session-control.js';
export * from './auto-book.js';

export function getWhatsAppTools(): ToolSpec[] {
  return [
    {
      name: 'whatsapp_send_message',
      description:
        'Send a WhatsApp message to a customer phone number. Use this to deliver all replies to the customer. ' +
        'To send multiple chat bubbles in sequence with realistic typing pauses, separate bubbles using "\\n---\\n". ' +
        'Every message must end with the signature tag "-r" on a new line at the very end of the final chat bubble (first/preceding bubbles do NOT carry "-r").',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone in E.164 format (+628...) or 628... format',
          },
          message: {
            type: 'string',
            description:
              'Message text to send via WhatsApp. Separate 2–3 chat bubbles using "\\n---\\n" (e.g. "halo kak 😊\\n---\\nrencana sewa kapan ya kak?\\n\\n-r"). Final bubble must end with signature tag "-r" on a new line.',
          },
        },
        required: ['phone', 'message'],
      },
      handler: handleWhatsappSendMessage,
    },
    {
      name: 'estimate_delivery_fee',
      description:
        'Calculate delivery fee from Santi Mebel Godean warehouse to a customer location. ' +
        'Accepts address name ("Condongcatur"), a Google Maps URL, or latitude/longitude coordinates.',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description:
              'Location name (e.g. "Condongcatur") or a Google Maps URL. ' +
              'Use this OR latitude+longitude, not both.',
          },
          latitude: {
            type: 'number',
            description: 'Destination latitude (e.g. -7.7935)',
          },
          longitude: {
            type: 'number',
            description: 'Destination longitude (e.g. 110.3768)',
          },
        },
        required: [],
      },
      handler: handleEstimateDeliveryFee,
    },
    {
      name: 'set_customer_note',
      description:
        'Store a private owner instruction for a specific customer. ' +
        'These notes are injected into Rara\'s webhook prompt each time the customer sends a message. ' +
        'Example: "Simbah Don, berikan diskon 10%". Only accessible via Telegram (not from webhook).',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          note: {
            type: 'string',
            description: 'Owner instruction or note for this customer',
          },
        },
        required: ['phone', 'note'],
      },
      handler: handleSetCustomerNote,
    },
    {
      name: 'escalate_to_owner',
      description:
        'Send a structured lead card notification to Don (owner) via Telegram. ' +
        'Also automatically mutes the bot for this customer for 30 minutes. ' +
        'Use for: special discount requests, claims of relationship with owner, customer insisting on delivery/pickup outside operational slots (06.00-09.00 & 17.00-21.00 WIB), complex situations.',
      inputSchema: {
        type: 'object',
        properties: {
          customerPhone: { type: 'string', description: 'Customer phone number' },
          customerName: { type: 'string', description: 'Customer name (or "Unknown")' },
          productInterest: { type: 'string', description: 'What product/service they are interested in' },
          escalationReason: { type: 'string', description: 'Why this needs owner attention' },
          leadSummary: { type: 'string', description: 'Full context summary of the conversation' },
          urgencyLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Lead urgency level',
          },
        },
        required: [
          'customerPhone',
          'customerName',
          'productInterest',
          'escalationReason',
          'leadSummary',
          'urgencyLevel',
        ],
      },
      handler: handleEscalateToOwner,
    },
    {
      name: 'manage_customer_whitelist',
      description:
        'Manage the dynamic customer whitelist stored in Redis. ' +
        'Add or remove phones to allow/block AI responses, or list all currently allowed phones.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'remove', 'list'],
            description: 'Action to perform: add a phone, remove a phone, or list all',
          },
          phone: {
            type: 'string',
            description: 'Phone number to add/remove. Not required for "list".',
          },
        },
        required: ['action'],
      },
      handler: handleManageCustomerWhitelist,
    },
    {
      name: 'take_over_conversation',
      description:
        'Mute the bot for a specific customer for 2 hours (HUMAN mode). ' +
        'Use when Don/Admin wants to handle the conversation directly. ' +
        'Only accessible via Telegram — not available from the webhook.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to mute bot for',
          },
          reason: {
            type: 'string',
            description: 'Optional reason for taking over',
          },
        },
        required: ['phone'],
      },
      handler: handleTakeOverConversation,
    },
    {
      name: 'return_to_bot',
      description:
        'Reactivate the bot for a customer that was previously muted. ' +
        'Deletes the HUMAN session mode from Redis so bot resumes answering. ' +
        'Only accessible via Telegram — not available from the webhook.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to reactivate bot for',
          },
        },
        required: ['phone'],
      },
      handler: handleReturnToBot,
    },
    {
      name: 'resume_bot',
      description:
        'Reactivate the bot for a customer that was previously muted (HUMAN mode). ' +
        'Deletes the HUMAN session mode from Redis so bot resumes answering. ' +
        'Alias for return_to_bot. Only accessible via Telegram.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to reactivate bot for',
          },
        },
        required: ['phone'],
      },
      handler: handleReturnToBot,
    },
    {
      name: 'get_last_escalated_lead',
      description:
        'Retrieve the latest customer lead escalated to owner/Don via WhatsApp/Telegram. ' +
        'Use this in Telegram when Don replies with instructions (e.g. "kasih diskon 10%", discount, approval, acc, "take over", tolak, nego) ' +
        'without explicitly stating the customer name or phone number.',
      inputSchema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Telegram chat ID of the owner/recipient (optional, defaults to Don: 8215203590)',
          },
        },
        required: [],
      },
      handler: handleGetLastEscalatedLead,
    },
    {
      name: 'whatsapp_send_qris',
      description: 'Sends the Santi Living QRIS payment QR code image to a customer via WhatsApp. Call this immediately after sending the invoice text — do NOT ask the customer which payment method they prefer first. Only provide BCA transfer details if the customer explicitly asks for bank transfer instead.',
      inputSchema: {
        type: 'object',
        properties: {
          customerPhone: {
            type: 'string',
            description: 'Customer phone number'
          }
        },
        required: ['customerPhone'],
      },
      handler: handleWhatsappSendQris,
    },
    {
      name: 'rental_order_auto_book_lead',
      description:
        'Autonomously create, confirm, and verify a rental order in Sync ERP from the latest escalated lead when Don approves payment (e.g. "sudah masuk" or "acc bayar") on Telegram. ' +
        'Automatically creates/finds the customer partner in Sync ERP, creates the rental order with items and dates, confirms it (CONFIRMED), validates DP payment (CONFIRMED), ' +
        'unmutes the bot, sends the official WhatsApp confirmation message to the customer with the order number, and returns the full order record for Telegram reporting.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          chatId: {
            type: 'string',
            description: 'Telegram chat ID of owner (optional, defaults to Don: 8215203590)',
          },
          customerPhone: { type: 'string', description: 'Optional override customer phone' },
          customerName: { type: 'string', description: 'Optional override customer name' },
          rentalStartDate: { type: 'string', description: 'Optional override start date (YYYY-MM-DD)' },
          rentalEndDate: { type: 'string', description: 'Optional override end date (YYYY-MM-DD)' },
          bundleSize: { type: 'string', description: 'Optional override bundle size (90, 100, 120, 160, 180)' },
          quantity: { type: 'number', description: 'Optional override quantity' },
          deliveryFee: { type: 'number', description: 'Optional override delivery fee' },
          deliveryAddress: { type: 'string', description: 'Optional override delivery address' },
          notes: { type: 'string', description: 'Optional override notes' },
          paymentReference: { type: 'string', description: 'Optional override payment reference (default: QRIS-DP)' },
        },
        required: ['companyId'],
      },
      handler: handleRentalOrderAutoBookLead,
    },
  ];
}
