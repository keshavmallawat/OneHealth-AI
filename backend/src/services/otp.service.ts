export class OtpService {
  /**
   * Generates a 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Mock implementation of sending an OTP via SMS/Email.
   */
  static async sendOTP(destination: string, otp: string): Promise<void> {
    // In a real scenario, integrate Firebase Admin SDK or Twilio here.
    console.log(`[MOCK FIREBASE] Sending OTP ${otp} to ${destination}`);
  }
}
