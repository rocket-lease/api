import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailProvider } from '@/domain/providers/email.provider';

@Injectable()
export class GmailEmailProvider implements EmailProvider {
  private readonly logger = new Logger(GmailEmailProvider.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const senderName = process.env.SMTP_SENDER_NAME ?? 'Rocket Lease';
    this.from = `${senderName} <${user}>`;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user, pass },
    });
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const html = this.renderTemplate(code);
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `Tu código de verificación: ${code}`,
        text: `Tu código de verificación de Rocket Lease es: ${code}\n\nExpira en 5 minutos.`,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send OTP email to ${email}: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  private renderTemplate(code: string): string {
    const digits = code.split('').join('</td><td style="padding:8px 12px;font-size:28px;font-weight:700;color:#e2d9f3;background:#241e38;border-radius:8px;letter-spacing:2px;">');
    return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background-color:#0f0b1a;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#e2d9f3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0b1a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:0 0 32px 0;">
          <div style="background:linear-gradient(135deg,#6C3BE2 0%,#aa3bff 100%);border-radius:14px;padding:12px 20px;font-size:22px;font-weight:700;color:#fff;display:inline-block;">🚀 Rocket Lease</div>
        </td></tr>
        <tr><td style="background-color:#1a1528;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:40px 32px;">
          <h1 style="margin:0 0 16px 0;font-size:24px;color:#e2d9f3;">Tu código de verificación</h1>
          <p style="margin:0 0 24px 0;font-size:15px;color:#a89dc0;line-height:1.6;">Ingresá este código en la app para verificar tu cuenta:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;border-spacing:8px;border-collapse:separate;"><tr><td style="padding:8px 12px;font-size:28px;font-weight:700;color:#e2d9f3;background:#241e38;border-radius:8px;letter-spacing:2px;">${digits}</td></tr></table>
          <p style="margin:24px 0 0 0;font-size:13px;color:#6b6080;line-height:1.6;">⏱️ Este código expira en <strong style="color:#a89dc0;">5 minutos</strong>.<br/>🔒 Si no solicitaste este código, ignorá este mail.</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 16px 0;"><p style="margin:0;font-size:12px;color:#6b6080;">Rocket Lease — Alquiler de vehículos</p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }
}
