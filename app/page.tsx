import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  const cookieStore = await cookies();
  const role = cookieStore.get("symx_role")?.value;

  // Returning drivers go straight to the Flutter app
  if (role === "driver") redirect("/app/");

  // Returning office users go straight to email/password login
  if (role === "office") redirect("/login");

  // First-time / unknown visitors → show the chooser
  return (
    <div className="chooser-root">
      {/* Background */}
      <div className="chooser-bg" />
      <div className="chooser-bg-overlay" />

      {/* Content */}
      <div className="chooser-content">
        {/* Logo */}
        <div className="chooser-logo-wrap">
          <Image
            src="/symx-logo.png"
            alt="SYMX Logistics"
            width={280}
            height={80}
            className="chooser-logo"
            priority
            style={{ width: "auto", height: "auto" }}
          />
          <div className="chooser-divider" />
          <h1 className="chooser-title">Welcome</h1>
          <p className="chooser-subtitle">Select how you&apos;d like to sign in</p>
        </div>

        {/* Chooser Buttons */}
        <div className="chooser-card">
          <Link href="/login" className="chooser-btn chooser-btn-office">
            <div className="chooser-btn-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div className="chooser-btn-text">
              <span className="chooser-btn-label">Office Login</span>
              <span className="chooser-btn-desc">Email &amp; password for managers</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chooser-btn-arrow">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <div className="chooser-separator">
            <span className="chooser-separator-line" />
            <span className="chooser-separator-text">or</span>
            <span className="chooser-separator-line" />
          </div>

          <Link href="/app/" className="chooser-btn chooser-btn-driver">
            <div className="chooser-btn-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <div className="chooser-btn-text">
              <span className="chooser-btn-label">Driver App</span>
              <span className="chooser-btn-desc">Badge login for drivers</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chooser-btn-arrow">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Footer */}
        <footer className="chooser-footer">
          © {new Date().getFullYear()} SYMX Systems. All rights reserved.
        </footer>
      </div>

      {/* Styles — mirrors login page aesthetic */}
      <style>{`
        .chooser-root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0e1a;
          position: relative;
          overflow: hidden;
          padding: 16px;
        }

        .chooser-bg {
          position: absolute;
          inset: 0;
          background-image: url('/login-bg.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: chooserBgZoom 30s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes chooserBgZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }

        .chooser-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(2, 6, 18, 0.78) 0%,
            rgba(5, 15, 40, 0.65) 40%,
            rgba(10, 20, 50, 0.72) 100%
          );
          pointer-events: none;
        }

        .chooser-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: chooserFadeIn 1s ease-out;
        }
        @keyframes chooserFadeIn {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .chooser-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 40px;
        }

        .chooser-logo {
          filter: drop-shadow(0 0 15px rgba(255,255,255,0.2));
        }

        .chooser-divider {
          margin-top: 24px;
          height: 1px;
          width: 96px;
          background: linear-gradient(to right, transparent, rgba(59,130,246,0.5), transparent);
        }

        .chooser-title {
          margin-top: 20px;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: 0.15em;
          color: white;
          text-transform: uppercase;
          text-align: center;
        }

        .chooser-subtitle {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.3em;
          font-weight: 300;
          text-align: center;
        }

        .chooser-card {
          width: 100%;
          background: linear-gradient(135deg, rgba(5, 12, 30, 0.85) 0%, rgba(8, 18, 45, 0.9) 100%);
          backdrop-filter: blur(50px) saturate(1.2);
          -webkit-backdrop-filter: blur(50px) saturate(1.2);
          border: 1px solid rgba(100, 160, 255, 0.1);
          padding: 28px;
          border-radius: 20px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 25px 60px -15px rgba(0,0,0,0.6),
            0 0 100px -25px rgba(37,99,235,0.15);
        }

        .chooser-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 20px;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255,255,255,0.08);
          position: relative;
          overflow: hidden;
        }
        .chooser-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 14px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .chooser-btn:hover::before {
          opacity: 1;
        }
        .chooser-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.15);
        }
        .chooser-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .chooser-btn-office {
          background: rgba(37, 99, 235, 0.08);
        }
        .chooser-btn-office::before {
          background: linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.04) 100%);
        }
        .chooser-btn-office:hover {
          box-shadow: 0 8px 30px -8px rgba(37,99,235,0.3);
        }

        .chooser-btn-driver {
          background: rgba(16, 185, 129, 0.08);
        }
        .chooser-btn-driver::before {
          background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%);
        }
        .chooser-btn-driver:hover {
          box-shadow: 0 8px 30px -8px rgba(16,185,129,0.3);
        }

        .chooser-btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 12px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        .chooser-btn-office .chooser-btn-icon {
          background: linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(37,99,235,0.08) 100%);
          color: #60a5fa;
        }
        .chooser-btn-driver .chooser-btn-icon {
          background: linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.08) 100%);
          color: #34d399;
        }

        .chooser-btn-text {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .chooser-btn-label {
          font-size: 16px;
          font-weight: 600;
          color: white;
          letter-spacing: 0.02em;
        }

        .chooser-btn-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          margin-top: 3px;
          letter-spacing: 0.01em;
        }

        .chooser-btn-arrow {
          color: rgba(255,255,255,0.3);
          flex-shrink: 0;
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }
        .chooser-btn:hover .chooser-btn-arrow {
          color: rgba(255,255,255,0.7);
          transform: translateX(4px);
        }

        .chooser-separator {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 16px 0;
        }

        .chooser-separator-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        .chooser-separator-text {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-weight: 500;
        }

        .chooser-footer {
          margin-top: 32px;
          color: rgba(255,255,255,0.3);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
