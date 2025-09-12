import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private toBool(v: any, def = false): boolean {
    if (v === undefined || v === null || v === '') return def;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return def;
  }

  private toNum(v: any, def: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  private async getSiteName(): Promise<string> {
    try {
      const row = await this.prisma.systemSettings.findUnique({
        where: { key: 'siteName' },
      });
      const val = row?.value;
      if (typeof val === 'string' && val.trim()) return val.trim();
      // Fallback to default if value is not a non-empty string
    } catch (err) {
      void err;
    }
    return 'Invoicy';
  }

  private async getAppUrl(): Promise<string> {
    try {
      const row = await this.prisma.systemSettings.findUnique({
        where: { key: 'APP_URL' },
      });
      let v =
        (row?.value as string | undefined) ??
        this.configService.get('APP_URL') ??
        this.configService.get('NEXT_PUBLIC_APP_URL') ??
        this.configService.get('FRONTEND_URL');
      if (typeof v !== 'string') v = v ? String(v) : '';
      v = v.trim();
      if (!v) return 'http://localhost:3000';
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) {
        v = `https://${v}`;
      }
      return v;
    } catch {
      const envVal =
        (this.configService.get('APP_URL') as string | undefined) ?? '';
      const cleaned = typeof envVal === 'string' ? envVal.trim() : String(envVal ?? '');
      if (cleaned) {
        return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)
          ? cleaned
          : `https://${cleaned}`;
      }
      return 'http://localhost:3000';
    }
  }

  private async loadEmailSettings(): Promise<{
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
    provider: 'SMTP' | 'SENDGRID' | 'BREVO';
    sendgridApiKey?: string;
    brevoApiKey?: string;
    trackOpens: boolean;
    trackClicks: boolean;
    connectionTimeout: number;
    greetingTimeout: number;
    socketTimeout: number;
    logger: boolean;
  }> {
    const keys = [
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_SECURE',
      'EMAIL_USER',
      'EMAIL_PASSWORD',
      'EMAIL_FROM',
      'EMAIL_PROVIDER',
      'SENDGRID_API_KEY',
      'BREVO_API_KEY',
      'EMAIL_TRACK_OPENS',
      'EMAIL_TRACK_CLICKS',
      'EMAIL_CONNECTION_TIMEOUT_MS',
      'EMAIL_GREETING_TIMEOUT_MS',
      'EMAIL_SOCKET_TIMEOUT_MS',
    ];
    const rows = await this.prisma.systemSettings.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value] as const));

    const host = (map.get('EMAIL_HOST') ??
      this.configService.get('EMAIL_HOST') ??
      'smtp.gmail.com') as string;
    const port = this.toNum(
      map.get('EMAIL_PORT') ?? this.configService.get('EMAIL_PORT') ?? 587,
      587,
    );
    const secure = this.toBool(
      map.get('EMAIL_SECURE') ??
        this.configService.get('EMAIL_SECURE') ??
        false,
      false,
    );
    const user = (map.get('EMAIL_USER') ??
      this.configService.get('EMAIL_USER')) as string | undefined;
    const pass = (map.get('EMAIL_PASSWORD') ??
      this.configService.get('EMAIL_PASSWORD')) as string | undefined;
    const from = (map.get('EMAIL_FROM') ??
      this.configService.get('EMAIL_FROM') ??
      'noreply@invoicy.com') as string;
    const providerRaw = (map.get('EMAIL_PROVIDER') ??
      this.configService.get('EMAIL_PROVIDER') ??
      'SMTP') as string;
    const providerStr = String(providerRaw || 'SMTP').toUpperCase();
    const provider = (providerStr === 'SENDGRID'
      ? 'SENDGRID'
      : providerStr === 'BREVO'
      ? 'BREVO'
      : 'SMTP') as 'SMTP' | 'SENDGRID' | 'BREVO';
    const sendgridApiKey = (map.get('SENDGRID_API_KEY') ??
      this.configService.get('SENDGRID_API_KEY')) as string | undefined;
    const brevoApiKey = (map.get('BREVO_API_KEY') ??
      this.configService.get('BREVO_API_KEY')) as string | undefined;
    const trackOpens = this.toBool(
      map.get('EMAIL_TRACK_OPENS') ??
        this.configService.get('EMAIL_TRACK_OPENS') ??
        true,
      true,
    );
    const trackClicks = this.toBool(
      map.get('EMAIL_TRACK_CLICKS') ??
        this.configService.get('EMAIL_TRACK_CLICKS') ??
        true,
      true,
    );
    const connectionTimeout = this.toNum(
      map.get('EMAIL_CONNECTION_TIMEOUT_MS') ??
        this.configService.get('EMAIL_CONNECTION_TIMEOUT_MS') ??
        10000,
      10000,
    );
    const greetingTimeout = this.toNum(
      map.get('EMAIL_GREETING_TIMEOUT_MS') ??
        this.configService.get('EMAIL_GREETING_TIMEOUT_MS') ??
        10000,
      10000,
    );
    const socketTimeout = this.toNum(
      map.get('EMAIL_SOCKET_TIMEOUT_MS') ??
        this.configService.get('EMAIL_SOCKET_TIMEOUT_MS') ??
        20000,
      20000,
    );
    const logger = this.configService.get('NODE_ENV') !== 'production';

    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      provider,
      sendgridApiKey,
      brevoApiKey,
      trackOpens,
      trackClicks,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      logger,
    };
  }

  private async buildTransporterFromSettings(): Promise<nodemailer.Transporter> {
    const cfg = await this.loadEmailSettings();
    const isBrevo = /brevo|sendinblue|smtp-relay\./i.test(cfg.host || '');
    const smtpUser = cfg.user;
    const smtpPass = isBrevo ? cfg.brevoApiKey : cfg.pass;

    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      connectionTimeout: cfg.connectionTimeout,
      greetingTimeout: cfg.greetingTimeout,
      socketTimeout: cfg.socketTimeout,
      logger: cfg.logger,
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: any[],
    options?: {
      replyTo?: string;
      fromName?: string;
      headers?: Record<string, string>;
    },
  ) {
    const cfg = await this.loadEmailSettings();

    // Choose provider
    if (cfg.provider === 'SENDGRID') {
      try {
        // Dynamically load to avoid hard dependency if not installed
        const mod = await import('@sendgrid/mail');
        const sgMail: any = (mod as any).default ?? (mod as any);
        if (!cfg.sendgridApiKey) {
          throw new Error(
            'SendGrid selected but SENDGRID_API_KEY is not configured',
          );
        }
        sgMail.setApiKey(cfg.sendgridApiKey);

        const fromEmail = cfg.from;
        const from = options?.fromName
          ? { email: fromEmail, name: options.fromName }
          : { email: fromEmail };

        const sgAttachments = (attachments || []).map((att) => ({
          content: Buffer.isBuffer(att.content)
            ? att.content.toString('base64')
            : att.content?.toString?.('base64') || '',
          filename: att.filename,
          type: att.contentType || 'application/octet-stream',
          disposition: 'attachment',
        }));

        const msg = {
          to,
          from,
          subject,
          html,
          attachments: sgAttachments.length ? sgAttachments : undefined,
          replyTo: options?.replyTo,
          headers: options?.headers,
          trackingSettings: {
            clickTracking: { enable: cfg.trackClicks },
            openTracking: { enable: cfg.trackOpens },
          },
        } as any;

        const [response] = await sgMail.send(msg);
        console.log(
          'Email sent via SendGrid:',
          response?.headers?.['x-message-id'] || response?.statusCode,
        );
        return {
          messageId: response?.headers?.['x-message-id'] || undefined,
          provider: 'SENDGRID',
        } as const;
      } catch (error) {
        if (
          error?.code === 'MODULE_NOT_FOUND' ||
          error?.code === 'ERR_MODULE_NOT_FOUND'
        ) {
          console.error(
            'SendGrid provider selected but @sendgrid/mail is not installed',
          );
          throw new Error(
            'SendGrid provider selected but @sendgrid/mail package is not installed on the server',
          );
        }
        console.error('Error sending email via SendGrid:', error);
        throw error;
      }
    }

    if (cfg.provider === 'BREVO') {
      try {
        if (!cfg.brevoApiKey) {
          throw new Error('Brevo selected but BREVO_API_KEY is not configured');
        }
        const fetchFn: any = (globalThis as any).fetch;
        if (typeof fetchFn !== 'function') {
          throw new Error('Brevo API requires Node 18+ with global fetch available');
        }
        const fromEmail = cfg.from;
        const sender = (options?.fromName
          ? { email: fromEmail, name: options.fromName }
          : { email: fromEmail }) as any;

        const brevoAttachments = (attachments || [])
          .map((att) => {
            const contentBase64 = Buffer.isBuffer(att.content)
              ? att.content.toString('base64')
              : att.content?.toString?.('base64');
            if (!contentBase64) return null;
            return { name: att.filename, content: contentBase64 } as any;
          })
          .filter(Boolean);

        const body: any = {
          sender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
        };
        if (options?.replyTo) body.replyTo = options.replyTo;
        if (options?.headers) body.headers = options.headers;
        if (brevoAttachments.length) body.attachment = brevoAttachments;

        const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': cfg.brevoApiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Brevo API error: ${res.status} ${res.statusText} - ${errText}`);
        }
        const data: any = await res.json().catch(() => ({}));
        const messageId = data?.messageId || data?.messageID || undefined;
        console.log('Email sent via Brevo API:', messageId || res.status);
        return { messageId, provider: 'BREVO' } as const;
      } catch (error) {
        console.error('Error sending email via Brevo API:', error);
        throw error;
      }
    }

    // Default to SMTP (nodemailer)
    const transporter = await this.buildTransporterFromSettings();
    try {
      const fromAddress = cfg.from;
      const from = options?.fromName
        ? `"${options.fromName}" <${fromAddress}>`
        : fromAddress;

      const mailOptions: nodemailer.SendMailOptions = {
        from,
        to,
        subject,
        html,
        attachments,
        replyTo: options?.replyTo,
        headers: options?.headers,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent (SMTP):', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email (SMTP):', error);
      throw error;
    }
  }

  async sendTestInvoiceEmail(to: string, overrides?: Record<string, any>) {
    if (!to) {
      throw new Error('Recipient email (to) is required');
    }
    const base = await this.loadEmailSettings();

    const providerOverride = (overrides?.EMAIL_PROVIDER || base.provider) as
      | 'SMTP'
      | 'SENDGRID'
      | 'BREVO';
    const from = (overrides?.EMAIL_FROM ?? base.from) as string;

    // Build sample invoice subject/html using previewTemplate for consistency
    const preview = await this.previewTemplate('invoice');
    const siteName = await this.getSiteName();
    const subject = preview.subject || `Invoice Test from ${siteName}`;
    const html = preview.html;

    // Friendly From and Reply-To (sample)
    const fromName = `Acme Inc. via ${siteName}`;
    const replyTo = 'billing@example.com';
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<mailto:${replyTo}?subject=Unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    if (providerOverride === 'SENDGRID') {
      try {
        const mod = await import('@sendgrid/mail');
        const sgMail: any = (mod as any).default ?? (mod as any);
        const apiKey = (overrides?.SENDGRID_API_KEY || base.sendgridApiKey) as
          | string
          | undefined;
        if (!apiKey) {
          throw new Error(
            'SENDGRID_API_KEY is required to send test invoice email with SendGrid',
          );
        }
        sgMail.setApiKey(apiKey);

        const fromEmail = from;
        const fromObj = fromName
          ? { email: fromEmail, name: fromName }
          : { email: fromEmail };

        const msg = {
          to,
          from: fromObj,
          subject,
          html,
          replyTo,
          headers,
          trackingSettings: {
            clickTracking: { enable: base.trackClicks },
            openTracking: { enable: base.trackOpens },
          },
        } as any;

        const [response] = await sgMail.send(msg);
        console.log(
          'Email sent via SendGrid:',
          response?.headers?.['x-message-id'] || response?.statusCode,
        );
        return {
          messageId: response?.headers?.['x-message-id'],
          provider: 'SENDGRID',
        } as const;
      } catch (e: any) {
        if (
          e?.code === 'MODULE_NOT_FOUND' ||
          e?.code === 'ERR_MODULE_NOT_FOUND'
        ) {
          console.error(
            'SendGrid provider selected but @sendgrid/mail is not installed',
          );
          throw new Error(
            'SendGrid provider selected but @sendgrid/mail package is not installed on the server',
          );
        }
        throw e;
      }
    }

    if (providerOverride === 'BREVO') {
      let apiKey = overrides?.BREVO_API_KEY as string | undefined;
      if (apiKey === '__SECRET__') {
        apiKey = (base as any).brevoApiKey as string | undefined;
      }
      if (!apiKey) {
        apiKey = (base as any).brevoApiKey as string | undefined;
      }
      if (!apiKey) {
        throw new Error(
          'BREVO_API_KEY is required to send test invoice email with Brevo',
        );
      }
      const fetchFn: any = (globalThis as any).fetch;
      if (typeof fetchFn !== 'function') {
        throw new Error('Brevo API requires Node 18+ with global fetch available');
      }
      const fromEmail = from;
      const sender = (fromName
        ? { email: fromEmail, name: fromName }
        : { email: fromEmail }) as any;

      const body: any = {
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      };
      if (replyTo) body.replyTo = replyTo;
      if (headers) body.headers = headers;

      const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Brevo API error: ${res.status} ${res.statusText} - ${errText}`);
      }
      const data: any = await res.json().catch(() => ({}));
      const messageId = data?.messageId || data?.messageID || undefined;
      console.log('Email sent via Brevo API:', messageId || res.status);
      return { messageId, provider: 'BREVO' } as const;
    }

    // Default to SMTP test (with overrides)
    const transporter = await this.buildTransporterWithOverrides(overrides);
    const info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to,
      subject,
      html,
      headers,
      replyTo,
    });
    return { success: true, messageId: info.messageId };
  }

  async sendInvoiceEmail(invoice: any, pdfBuffer: Buffer) {
    const siteName = await this.getSiteName();
    const subject = `Invoice #${invoice.invoiceNumber} from ${invoice.user.companyName || invoice.user.firstName + ' ' + invoice.user.lastName}`;
    const appUrl = await this.getAppUrl();
    const publicLink =
      invoice?.shareEnabled && invoice?.shareId
        ? new URL(`/public/invoices/${invoice.shareId}`, appUrl).toString()
        : undefined;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .invoice-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice #${invoice.invoiceNumber}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${invoice.client.name},</p>
            
            <p>Please find attached your invoice from ${invoice.user.companyName || invoice.user.firstName + ' ' + invoice.user.lastName}.</p>
            
            <div class="invoice-details">
              <div class="detail-row">
                <strong>Invoice Number:</strong>
                <span>${invoice.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <strong>Invoice Date:</strong>
                <span>${new Date(invoice.invoiceDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <strong>Due Date:</strong>
                <span>${new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <strong>Balance Due:</strong>
                <span>${invoice.currency} ${invoice.balanceDue.toFixed(2)}</span>
              </div>
            </div>
            
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
            
            <p>Please make payment by the due date mentioned above.</p>
            ${
              publicLink
                ? `<p style="text-align:center"><a href="${publicLink}" class="button" style="color:#ffffff !important;background-color:#4F46E5;text-decoration:none;border-radius:5px;padding:12px 24px;display:inline-block;">View & Pay Invoice</a></p>
            <p style="text-align:center;color:#6b7280;font-size:12px">If the button doesn't work, copy and paste this link: <span style="word-break:break-all;color:#4F46E5">${publicLink}</span></p>`
                : ''
            }
            
            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
            
            <p>Thank you for your business!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${invoice.user.companyName || siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments = [
      {
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    const fromName = `${invoice.user.companyName || invoice.user.firstName + ' ' + invoice.user.lastName} via ${siteName}`;
    const replyTo = invoice.user.companyEmail || invoice.user.email;
    const headers: Record<string, string> = {};
    if (replyTo) {
      // Basic unsubscribe hint via mailto for clients; real one-click can be added later
      headers['List-Unsubscribe'] = `<mailto:${replyTo}?subject=Unsubscribe>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    return this.sendEmail(invoice.client.email, subject, html, attachments, {
      replyTo,
      fromName,
      headers,
    });
  }

  async sendPasswordResetEmail(user: any, resetToken: string) {
    const appUrl = await this.getAppUrl();
    const resetUrl = new URL(
      `/reset-password?token=${resetToken}`,
      appUrl,
    ).toString();

    const siteName = await this.getSiteName();
    const subject = 'Password Reset Request';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          
          <div class="content">
            <p>Hi ${user.firstName || 'User'},</p>
            
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            
            <center>
              <a href="${resetUrl}" class="button" style="color:#ffffff !important;background-color:#4F46E5;text-decoration:none;border-radius:5px;padding:12px 24px;display:inline-block;">Reset Password</a>
            </center>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
            
            <p>This link will expire in 1 hour for security reasons.</p>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendEmailVerification(user: any, verificationToken: string) {
    const appUrl = await this.getAppUrl();
    const verifyUrl = new URL(
      `/verify-email?token=${verificationToken}`,
      appUrl,
    ).toString();

    const siteName = await this.getSiteName();
    const subject = `Welcome to ${siteName} - Verify Your Email`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${siteName}!</h1>
          </div>
          
          <div class="content">
            <p>Hi ${user.firstName || 'User'},</p>
            
            <p>Welcome to ${siteName}! We're excited to have you on board. To get started and access all features, please verify your email address by clicking the button below:</p>
            
            <center>
              <a href="${verifyUrl}" class="button" style="color:#ffffff !important;background-color:#4F46E5;text-decoration:none;border-radius:5px;padding:12px 24px;display:inline-block;">Verify Email & Get Started</a>
            </center>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${verifyUrl}</p>
            
            <p>This verification link will expire in ${Number(this.configService.get('EMAIL_VERIFICATION_EXPIRATION_HOURS', 48))} hours.</p>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Create your first invoice</li>
              <li>Add clients to your database</li>
              <li>Set up payment tracking</li>
              <li>Customize your invoice templates</li>
            </ul>
            
            <p>Once verified, you'll have full access to all ${siteName} features!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendWelcomeEmail(user: any) {
    const siteName = await this.getSiteName();
    const subject = `Welcome to ${siteName}!`;
    const appUrl = await this.getAppUrl();
    const dashboardUrl = new URL('/dashboard', appUrl).toString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { padding: 10px 0; border-bottom: 1px solid #ddd; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${siteName}!</h1>
          </div>
          
          <div class="content">
            <p>Hi ${user.firstName || 'User'},</p>
            
            <p>Welcome aboard! We're excited to have you as part of the ${siteName} community.</p>
            
            <h3>Here's what you can do with ${siteName}:</h3>
            
            <div class="feature">
              <strong>📄 Create Professional Invoices</strong>
              <p>Design and send beautiful invoices in minutes</p>
            </div>
            
            <div class="feature">
              <strong>👥 Manage Clients</strong>
              <p>Keep all your client information organized in one place</p>
            </div>
            
            <div class="feature">
              <strong>💰 Track Payments</strong>
              <p>Monitor payment status and send reminders automatically</p>
            </div>
            
            <div class="feature">
              <strong>📊 View Analytics</strong>
              <p>Get insights into your business performance</p>
            </div>
            
            <center>
              <a href="${dashboardUrl}" class="button" style="color:#ffffff !important;background-color:#4F46E5;text-decoration:none;border-radius:5px;padding:12px 24px;display:inline-block;">Go to Dashboard</a>
            </center>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Happy invoicing!</p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendPaymentReceivedEmail(
    user: any,
    client: any,
    invoice: any,
    amount: number,
  ) {
    const siteName = await this.getSiteName();
    const subject = `Payment Received for Invoice #${invoice.invoiceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .payment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Received! 🎉</h1>
          </div>
          
          <div class="content">
            <p>Hi ${user.firstName || 'User'},</p>
            
            <p>Great news! We've received a payment from ${client.name}.</p>
            
            <div class="payment-details">
              <div class="detail-row">
                <strong>Invoice Number:</strong>
                <span>${invoice.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <strong>Client:</strong>
                <span>${client.name}</span>
              </div>
              <div class="detail-row">
                <strong>Amount Received:</strong>
                <span>${invoice.currency} ${amount.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <strong>Payment Date:</strong>
                <span>${new Date().toLocaleDateString()}</span>
              </div>
            </div>
            
            <p>The payment has been recorded in your account.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Invoicy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendClientPaymentReceiptEmail(
    client: any,
    invoice: any,
    amount: number,
    user: any,
  ) {
    const siteName = await this.getSiteName();
    const subject = `Receipt for Invoice #${invoice.invoiceNumber}`;
    const appUrl = await this.getAppUrl();
    const publicLink =
      invoice?.shareEnabled && invoice?.shareId
        ? new URL(`/public/invoices/${invoice.shareId}`, appUrl).toString()
        : undefined;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .button { display: inline-block; padding: 10px 18px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt</h1>
          </div>
          <div class="content">
            <p>Dear ${client?.name || 'Valued Client'},</p>
            <p>We have received your payment. Thank you!</p>
            <div class="details">
              <div class="detail-row"><strong>Invoice Number:</strong><span>${invoice.invoiceNumber}</span></div>
              <div class="detail-row"><strong>Amount Paid:</strong><span>${invoice.currency} ${Number(amount).toFixed(2)}</span></div>
              <div class="detail-row"><strong>Payment Date:</strong><span>${new Date().toLocaleDateString()}</span></div>
              <div class="detail-row"><strong>Balance Due:</strong><span>${invoice.currency} ${Number(invoice.balanceDue ?? Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0))).toFixed(2)}</span></div>
            </div>
            ${publicLink ? `<p>You can view the invoice here:</p><p><a href="${publicLink}" class="button" style="color:#ffffff !important;background-color:#4F46E5;text-decoration:none;border-radius:6px;padding:10px 18px;display:inline-block;">View Invoice</a></p>` : ''}
            <p>If you have any questions, just reply to this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${user?.companyName || siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fromName = `${user?.companyName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : siteName)} via ${siteName}`;
    const replyTo = user?.companyEmail || user?.email;
    const headers: Record<string, string> = {};
    if (replyTo) {
      headers['List-Unsubscribe'] = `<mailto:${replyTo}?subject=Unsubscribe>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    return this.sendEmail(client.email, subject, html, undefined, {
      replyTo,
      fromName,
      headers,
    });
  }

  async sendPlanUpgradedEmail(
    user: any,
    plan: string,
    subscriptionEnd?: Date | string | null,
    invoiceLimit?: number | null,
  ) {
    const siteName = await this.getSiteName();
    const subject = `Your plan has been upgraded to ${String(plan).toUpperCase()}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Plan Upgraded</h1></div>
          <div class="content">
            <p>Hi ${user?.firstName || 'there'},</p>
            <p>Your ${siteName} account has been upgraded to <strong>${String(plan).toUpperCase()}</strong>.</p>
            ${subscriptionEnd ? `<p>Your subscription is active until <strong>${new Date(subscriptionEnd).toLocaleDateString()}</strong>.</p>` : ''}
            ${typeof invoiceLimit === 'number' ? `<p>Your invoice limit is <strong>${invoiceLimit === 0 ? 'Unlimited' : invoiceLimit}</strong>.</p>` : ''}
            <p>Thanks for upgrading — we hope you enjoy the additional features!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${await this.getSiteName()}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(user.email, subject, html);
  }

  async sendPlanDowngradedEmail(user: any, plan: string) {
    const siteName = await this.getSiteName();
    const subject = `Your plan has been changed to ${String(plan).toUpperCase()}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6B7280; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Plan Updated</h1></div>
          <div class="content">
            <p>Hi ${user?.firstName || 'there'},</p>
            <p>Your ${siteName} account plan is now <strong>${String(plan).toUpperCase()}</strong>.</p>
            <p>If this was a mistake or you’d like to upgrade again, you can do that anytime from your settings.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(user.email, subject, html);
  }

  async sendPaymentReminderEmail(invoice: any, daysOverdue: number) {
    const subject = `Payment Reminder: Invoice #${invoice.invoiceNumber} ${daysOverdue > 0 ? `(${daysOverdue} days overdue)` : ''}`;
    const siteName = await this.getSiteName();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${daysOverdue > 0 ? '#EF4444' : '#F59E0B'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .invoice-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Reminder</h1>
          </div>
          
          <div class="content">
            <p>Dear ${invoice.client.name},</p>
            
            <p>${
              daysOverdue > 0
                ? `This is a reminder that payment for the following invoice is now ${daysOverdue} days overdue.`
                : 'This is a friendly reminder that payment for the following invoice is due soon.'
            }</p>
            
            <div class="invoice-details">
              <div class="detail-row">
                <strong>Invoice Number:</strong>
                <span>${invoice.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <strong>Invoice Date:</strong>
                <span>${new Date(invoice.invoiceDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <strong>Due Date:</strong>
                <span>${new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <strong>Outstanding Amount:</strong>
                <span>${invoice.currency} ${invoice.balanceDue.toFixed(2)}</span>
              </div>
            </div>
            
            <p>Please arrange payment at your earliest convenience.</p>
            
            <p>If you have already made this payment, please disregard this reminder. If you have any questions or concerns, please don't hesitate to contact us.</p>
            
            <p>Thank you for your prompt attention to this matter.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${invoice.user.companyName || siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const fromName = `${invoice.user.companyName || invoice.user.firstName + ' ' + invoice.user.lastName} via ${siteName}`;
    const replyTo = invoice.user.companyEmail || invoice.user.email;
    const headers: Record<string, string> = {};
    if (replyTo) {
      headers['List-Unsubscribe'] = `<mailto:${replyTo}?subject=Unsubscribe>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    return this.sendEmail(invoice.client.email, subject, html, undefined, {
      replyTo,
      fromName,
      headers,
    });
  }

  async sendNewClientAddedEmail(user: any, client: any) {
    const siteName = await this.getSiteName();
    const subject = `New client added: ${client.name}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Client Added</h1>
          </div>
          <div class="content">
            <p>Hi ${user.firstName || 'there'},</p>
            <p>You have successfully added a new client to your ${siteName} account.</p>
            <div class="details">
              <div class="detail-row">
                <strong>Client Name:</strong>
                <span>${client.name}</span>
              </div>
              <div class="detail-row">
                <strong>Email:</strong>
                <span>${client.email}</span>
              </div>
              ${client.companyName ? `<div class="detail-row"><strong>Company:</strong><span>${client.companyName}</span></div>` : ''}
            </div>
            <p>You can now create invoices for this client or manage their details from your dashboard.</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${user.companyName || siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // Preview templates without sending (admin use)
  async previewTemplate(
    type:
      | 'invoice'
      | 'payment-reminder'
      | 'payment-received'
      | 'password-reset'
      | 'verify-email'
      | 'welcome' = 'welcome',
  ): Promise<{ subject: string; html: string }> {
    const siteName = await this.getSiteName();
    const appUrl = await this.getAppUrl();
    const sampleUser = {
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Acme Inc.',
    } as any;
    const sampleClient = {
      name: 'John Client',
      email: 'client@example.com',
    } as any;
    const sampleInvoice = {
      invoiceNumber: 'INV-00001',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400000),
      currency: 'USD',
      balanceDue: 1234.56,
      notes: 'Thank you for your business.',
      user: sampleUser,
      client: sampleClient,
    } as any;

    if (type === 'invoice') {
      const subject = `Invoice #${sampleInvoice.invoiceNumber} from ${sampleUser.companyName}`;
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
          <div style="max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#4F46E5;color:#fff;padding:20px;text-align:center">
              <h1>Invoice #${sampleInvoice.invoiceNumber}</h1>
            </div>
            <div style="padding:20px;background:#f9f9f9">
              <p>Dear ${sampleClient.name},</p>
              <p>Please find your invoice from ${sampleUser.companyName} below.</p>
              <div style="background:#fff;padding:15px;border-radius:6px;margin:15px 0">
                <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Invoice Date:</b><span>${new Date(sampleInvoice.invoiceDate).toLocaleDateString()}</span></div>
                <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Due Date:</b><span>${new Date(sampleInvoice.dueDate).toLocaleDateString()}</span></div>
                <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Balance Due:</b><span>${sampleInvoice.currency} ${sampleInvoice.balanceDue.toFixed(2)}</span></div>
              </div>
              <p><b>Notes:</b> ${sampleInvoice.notes}</p>
              <p>Please make payment by the due date mentioned above.</p>
            </div>
          </div>
        </body></html>`;
      return { subject, html };
    }

    if (type === 'payment-reminder') {
      const subject = `Payment Reminder: Invoice #${sampleInvoice.invoiceNumber}`;
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#F59E0B;color:#fff;padding:20px;text-align:center"><h1>Payment Reminder</h1></div>
          <div style="padding:20px;background:#f9f9f9">
            <p>Dear ${sampleClient.name},</p>
            <p>This is a friendly reminder that payment for the following invoice is due soon.</p>
            <div style="background:#fff;padding:15px;border-radius:6px;margin:15px 0">
              <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Invoice Number:</b><span>${sampleInvoice.invoiceNumber}</span></div>
              <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Due Date:</b><span>${new Date(sampleInvoice.dueDate).toLocaleDateString()}</span></div>
              <div style="display:flex;justify-content:space-between;margin:10px 0"><b>Outstanding Amount:</b><span>${sampleInvoice.currency} ${sampleInvoice.balanceDue.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </body></html>`;
      return { subject, html };
    }

    if (type === 'payment-received') {
      const subject = `Payment Received for Invoice #${sampleInvoice.invoiceNumber}`;
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#10B981;color:#fff;padding:20px;text-align:center"><h1>Payment Received! 🎉</h1></div>
          <div style="padding:20px;background:#f9f9f9">
            <p>Hi ${sampleUser.firstName},</p>
            <p>We have recorded a payment from ${sampleClient.name} for invoice ${sampleInvoice.invoiceNumber}.</p>
          </div>
        </div>
      </body></html>`;
      return { subject, html };
    }

    if (type === 'password-reset') {
      const subject = 'Password Reset Request';
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#4F46E5;color:#fff;padding:20px;text-align:center"><h1>Password Reset</h1></div>
          <div style="padding:20px;background:#f9f9f9">
            <p>Hi ${sampleUser.firstName},</p>
            <p>Click the button below to reset your password:</p>
            <p><a href="${appUrl}/reset-password?token=sample" style="display:inline-block;padding:10px 16px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
          </div>
        </div>
      </body></html>`;
      return { subject, html };
    }

    if (type === 'verify-email') {
      const subject = 'Verify Your Email Address';
      const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#4F46E5;color:#fff;padding:20px;text-align:center"><h1>Welcome to ${siteName}!</h1></div>
          <div style="padding:20px;background:#f9f9f9">
            <p>Hi ${sampleUser.firstName},</p>
            <p>Please verify your email by clicking below:</p>
            <p><a href="${appUrl}/verify-email?token=sample" style="display:inline-block;padding:10px 16px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none">Verify Email</a></p>
          </div>
        </div>
      </body></html>`;
      return { subject, html };
    }

    // welcome
    const subject = `Welcome to ${siteName}!`;
    const html = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height:1.6">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#4F46E5;color:#fff;padding:20px;text-align:center"><h1>Welcome to ${siteName}!</h1></div>
        <div style="padding:20px;background:#f9f9f9">
          <p>Hi ${sampleUser.firstName},</p>
          <p>We're excited to have you on board. Get started by creating your first invoice.</p>
          <p><a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 16px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none">Go to Dashboard</a></p>
        </div>
      </div>
    </body></html>`;
    return { subject, html };
  }

  // Utilities for Admin to test SMTP configuration without persisting
  private async buildTransporterWithOverrides(
    overrides?: Record<string, any>,
  ): Promise<nodemailer.Transporter> {
    const base = await this.loadEmailSettings();
    const o = overrides || {};

    const host = (o.EMAIL_HOST ?? base.host) as string;
    const port = this.toNum(o.EMAIL_PORT ?? base.port, base.port);
    const secure = this.toBool(o.EMAIL_SECURE ?? base.secure, base.secure);

    // Username: allow explicit empty string to clear auth
    let user = o.EMAIL_USER === '' ? undefined : (o.EMAIL_USER ?? base.user);
    // Password: respect sentinel to keep existing
    let pass: string | undefined;
    if (Object.prototype.hasOwnProperty.call(o, 'EMAIL_PASSWORD')) {
      pass =
        o.EMAIL_PASSWORD === '__SECRET__'
          ? base.pass
          : o.EMAIL_PASSWORD || undefined;
    } else {
      pass = base.pass;
    }

    // Brevo (Sendinblue) support: API key as SMTP password, username = 'apikey'
    const isBrevo = /brevo|sendinblue|smtp-relay\./i.test(host || '');
    const brevoKeyOverride =
      o.BREVO_API_KEY === '__SECRET__'
        ? (base as any).brevoApiKey
        : (o.BREVO_API_KEY as string | undefined);
    const brevoKey = (brevoKeyOverride ?? (base as any).brevoApiKey) as
      | string
      | undefined;
    if (isBrevo) {
      // For Brevo SMTP, use API key as password if provided; username can be account email or as configured
      if (brevoKey) {
        pass = String(brevoKey);
      }
    }

    // If frontend sent sentinel but server has no stored password, fail early with a clear message
    if (
      user &&
      !pass &&
      Object.prototype.hasOwnProperty.call(o, 'EMAIL_PASSWORD') &&
      o.EMAIL_PASSWORD === '__SECRET__'
    ) {
      throw new Error(
        'SMTP password is not configured on the server. Enter your actual SMTP password/key instead of "__SECRET__" or save it in Settings first.',
      );
    }

    const from = (o.EMAIL_FROM ?? base.from) as string;
    const connectionTimeout = this.toNum(
      o.EMAIL_CONNECTION_TIMEOUT_MS ?? base.connectionTimeout,
      base.connectionTimeout,
    );
    const greetingTimeout = this.toNum(
      o.EMAIL_GREETING_TIMEOUT_MS ?? base.greetingTimeout,
      base.greetingTimeout,
    );
    const socketTimeout = this.toNum(
      o.EMAIL_SOCKET_TIMEOUT_MS ?? base.socketTimeout,
      base.socketTimeout,
    );

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      logger: base.logger,
    });
  }

  async verifySmtp(
    overrides?: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    const transporter = await this.buildTransporterWithOverrides(overrides);
    try {
      await transporter.verify();
      return { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'SMTP verification failed',
      };
    }
  }

  async sendTestEmail(to: string, overrides?: Record<string, any>) {
    if (!to) {
      throw new Error('Recipient email (to) is required');
    }
    const base = await this.loadEmailSettings();

    const providerOverride = (overrides?.EMAIL_PROVIDER || base.provider) as
      | 'SMTP'
      | 'SENDGRID'
      | 'BREVO';
    const from = (overrides?.EMAIL_FROM ?? base.from) as string;

    const siteName = await this.getSiteName();
    const subject = `${siteName} Email Test`;
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Email Test Successful</h2>
        <p>This is a test email sent from ${siteName} using the currently configured provider (${providerOverride}).</p>
        <p>Time: ${new Date().toISOString()}</p>
      </body>
      </html>
    `;

    if (providerOverride === 'SENDGRID') {
      try {
        const sgMail = require('@sendgrid/mail');
        const apiKey = (overrides?.SENDGRID_API_KEY || base.sendgridApiKey) as
          | string
          | undefined;
        if (!apiKey) {
          throw new Error(
            'SENDGRID_API_KEY is required to send test email with SendGrid',
          );
        }
        sgMail.setApiKey(apiKey);
        const msg = {
          to,
          from: { email: from, name: `${siteName} Test` },
          subject,
          html,
          trackingSettings: {
            clickTracking: { enable: base.trackClicks },
            openTracking: { enable: base.trackOpens },
          },
        } as any;
        const [response] = await sgMail.send(msg);
        return {
          success: true,
          messageId: response?.headers?.['x-message-id'],
        };
      } catch (e: any) {
        if (e?.code === 'MODULE_NOT_FOUND') {
          throw new Error(
            'SendGrid test requested but @sendgrid/mail is not installed',
          );
        }
        throw e;
      }
    }

    if (providerOverride === 'BREVO') {
      let apiKey = overrides?.BREVO_API_KEY as string | undefined;
      if (apiKey === '__SECRET__') {
        apiKey = (base as any).brevoApiKey as string | undefined;
      }
      if (!apiKey) {
        apiKey = (base as any).brevoApiKey as string | undefined;
      }
      if (!apiKey) {
        throw new Error('BREVO_API_KEY is required to send test email with Brevo');
      }
      const fetchFn: any = (globalThis as any).fetch;
      if (typeof fetchFn !== 'function') {
        throw new Error('Brevo API requires Node 18+ with global fetch available');
      }
      const sender = { email: from, name: `${siteName} Test` } as any;
      const body: any = {
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      };
      const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Brevo API error: ${res.status} ${res.statusText} - ${errText}`,
        );
      }
      const data: any = await res.json().catch(() => ({}));
      return { success: true, messageId: data?.messageId };
    }

    // Default to SMTP test
    const transporter = await this.buildTransporterWithOverrides(overrides);
    try {
      const info = await transporter.sendMail({ from, to, subject, html });
      return { success: true, messageId: info.messageId };
    } catch (e: any) {
      // Common misconfig hint for Brevo/Sendinblue when using unverified Gmail sender
      const host = (overrides?.EMAIL_HOST || base.host) as string;
      let msg = e?.message || 'Failed to send email via SMTP';
      try {
        if (/brevo|sendinblue|smtp-relay\./i.test(host) && /@gmail\.com$/i.test(from)) {
          msg +=
            ' Hint: Brevo requires a verified sender address. Add and verify the From address in Brevo or use a domain you own (not a Gmail address), then update EMAIL_FROM.';
        }
      } catch {}
      throw new Error(msg);
    }
  }
}
