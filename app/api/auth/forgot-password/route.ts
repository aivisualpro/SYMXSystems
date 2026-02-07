import { NextResponse } from "next/server";
import { Resend } from "resend";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    await connectToDatabase();

    const user = await SymxUser.findOne({ email: email.toLowerCase(), isActive: true });

    if (!user) {
      // For security reasons, don't reveal if the user exists or not
      return NextResponse.json({ message: "If an active account exists with that email, the password has been sent." });
    }

    // Prepare the email template
    const { data, error } = await resend.emails.send({
      from: "SYMX Systems Support <info@adeelfullstack.com>",
      to: [user.email],
      subject: "Your SYMX Systems Password Recovery",
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; rounded-xl">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://symx-systems-erp.vercel.app/logo.png" alt="SYMX Systems" style="width: 80px; height: 80px;" />
          </div>
          <h2 style="color: #18181b; text-align: center;">Password Recovery</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            Hello <strong>${user.name}</strong>,
          </p>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            You requested to recover your password for the SYMX Systems ERP system.
          </p>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; color: #71717a; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Current Password</p>
            <p style="margin: 10px 0 0 0; color: #18181b; font-size: 24px; font-weight: bold;">${user.password}</p>
          </div>
          <div style="text-align: center; margin-top: 40px;">
            <a href="https://symx-systems-erp.vercel.app/login" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Log In to Dashboard</a>
          </div>
          <hr style="margin-top: 50px; border: 0; border-top: 1px solid #e4e4e7;" />
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 20px;">
            If you did not request this email, please ignore it or contact your administrator.
            <br />© ${new Date().getFullYear()} SYMX Systems. All rights reserved.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ message: "Password sent successfully" });
  } catch (error: any) {
    console.error("Forgot password API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
