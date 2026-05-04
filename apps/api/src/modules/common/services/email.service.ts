export interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: string;
  error?: string;
}

type EmailProvider = 'log' | 'resend';

export class EmailService {
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private getProvider(): EmailProvider {
    const provider = process.env.SYNC_ERP_EMAIL_PROVIDER;
    return provider === 'resend' ? 'resend' : 'log';
  }

  private getFromEmail(): string {
    return (
      process.env.SYNC_ERP_EMAIL_FROM ||
      'Sync ERP <noreply@sync-erp.local>'
    );
  }

  private buildVerificationHtml(
    params: SendVerificationEmailParams
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
        <h2 style="margin-bottom: 16px;">Verify your email</h2>
        <p style="margin-bottom: 12px;">Hi ${params.name},</p>
        <p style="margin-bottom: 16px;">
          Thanks for registering on Sync ERP. Please verify your email address to activate your account.
        </p>
        <p style="margin-bottom: 24px;">
          <a
            href="${params.verificationUrl}"
            style="background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; display: inline-block;"
          >
            Verify Email
          </a>
        </p>
        <p style="margin-bottom: 12px; font-size: 14px; color: #4b5563;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; font-size: 14px; color: #2563eb;">
          ${params.verificationUrl}
        </p>
        <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">
          This link expires in 24 hours.
        </p>
      </div>
    `.trim();
  }

  async sendVerificationEmail(
    params: SendVerificationEmailParams
  ): Promise<EmailDeliveryResult> {
    const provider = this.getProvider();

    if (this.isProduction() && provider === 'log') {
      return {
        delivered: false,
        provider: 'log',
        error:
          'Log email provider is not allowed in production.',
      };
    }

    if (provider === 'resend') {
      return this.sendViaResend(params);
    }

    console.log(
      `[EmailService] Verification email for ${params.to}: ${params.verificationUrl}`
    );

    return {
      delivered: true,
      provider: 'log',
    };
  }

  private async sendViaResend(
    params: SendVerificationEmailParams
  ): Promise<EmailDeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = this.getFromEmail();

    if (!apiKey) {
      if (!this.isProduction()) {
        console.warn(
          '[EmailService] RESEND_API_KEY is missing, falling back to log provider.'
        );
        console.log(
          `[EmailService] Verification email for ${params.to}: ${params.verificationUrl}`
        );
        return {
          delivered: true,
          provider: 'log',
        };
      }

      return {
        delivered: false,
        provider: 'resend',
        error: 'RESEND_API_KEY is missing.',
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: 'Verify your Sync ERP account',
          html: this.buildVerificationHtml(params),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Resend API error ${response.status}: ${errorText}`
        );
      }

      return {
        delivered: true,
        provider: 'resend',
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown email delivery error';
      console.error('[EmailService] Failed to send email:', message);
      return {
        delivered: false,
        provider: 'resend',
        error: message,
      };
    }
  }
}
