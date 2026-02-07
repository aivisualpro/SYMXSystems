"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animations
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        keepalive: true,
        cache: 'no-store'
      });

      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        throw new Error("Server returned non-JSON response. The server might be restarting or timing out.");
      }

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(result.error || "Your account is inactive. Please contact your administrator.");
        } else if (response.status === 401) {
          toast.error("Invalid email or password. Please check your credentials.");
        } else if (response.status === 404) {
           toast.error("User not found.");
        } else {
          toast.error(result.error || "An error occurred during login.");
        }
        setIsLoading(false);
        return;
      }
      
      toast.success(`Welcome back, ${result.user.name}`);
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[Login Error]", err);
      if (err.name === 'AbortError' || err.message === 'Failed to fetch') {
        toast.error("Network error or connection lost. Please refresh the page and try again.");
      } else {
        toast.error(err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        setIsForgotMode(false);
      } else {
        toast.error(result.error || "Something went wrong");
      }
    } catch (err) {
      toast.error("Failed to send recovery email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0e1a] px-4 relative overflow-hidden">

      {/* ── Background Image ── */}
      <div className="login-bg" />
      {/* Dark overlay for contrast */}
      <div className="login-bg-overlay" />

      {/* Floating particles (only rendered client-side to avoid hydration mismatch) */}
      {mounted && (
        <div className="login-particles">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="login-particle" style={{
              left: `${(i * 7.3 + 5) % 100}%`,
              animationDelay: `${(i * 0.53) % 8}s`,
              animationDuration: `${6 + (i * 0.87) % 8}s`,
              width: `${2 + (i * 0.37) % 3}px`,
              height: `${2 + (i * 0.37) % 3}px`,
              opacity: 0.1 + ((i * 0.13) % 0.2),
            }} />
          ))}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className={`w-full max-w-[420px] z-10 transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Logo Section */}
        <div className={`flex flex-col items-center mb-10 transition-all duration-1000 delay-200 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className="relative group">
            {/* Spotlight behind logo for contrast */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-white/40 blur-3xl rounded-full scale-125 group-hover:bg-white/50 group-hover:scale-135 transition-all duration-700" />
            
            <Image
              src="/symx-logo.png"
              alt="SYMX Logistics"
              width={280}
              height={80}
              className="relative object-contain drop-shadow-sm transition-transform duration-700 hover:scale-[1.03] animate-logo-entrance"
              priority
            />
          </div>
          
          {/* Divider line with animation */}
          <div className={`mt-6 h-px w-16 bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-all duration-1000 delay-700 ${mounted ? 'opacity-100 w-16' : 'opacity-0 w-0'}`} />
          
          <h1 className={`mt-5 text-xl font-medium tracking-wide text-white text-center transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {isForgotMode ? "Recover Password" : "Welcome Back"}
          </h1>
          <p className={`text-zinc-200 mt-1.5 text-sm font-light text-center transition-all duration-700 delay-600 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {isForgotMode 
              ? "Submit your email and we'll send your password" 
              : "Sign in to your account to continue"}
          </p>
        </div>

        {/* Form Card */}
        <div className={`login-card transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {isForgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-[11px] uppercase tracking-[0.15em] font-semibold ml-1">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-blue-400 transition-colors duration-300" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@symxlogistics.com"
                    className="login-input pl-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="login-button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Password
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="text-xs text-zinc-300 hover:text-white transition-colors duration-300 font-medium"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-[11px] uppercase tracking-[0.15em] font-semibold ml-1">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-blue-400 transition-colors duration-300" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@symxlogistics.com"
                    className="login-input pl-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white text-[11px] uppercase tracking-[0.15em] font-semibold ml-1">
                    Password
                  </Label>
                  <button 
                    type="button"
                    onClick={() => setIsForgotMode(true)}
                    className="text-[11px] text-zinc-300 hover:text-white transition-colors duration-300"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-blue-400 transition-colors duration-300" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="login-input pl-11 pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white transition-colors duration-300 p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="login-button group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Footer removed "Need Access" section */}
        </div>
      </div>

      {/* Footer */}
      <footer className={`absolute bottom-6 text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium z-10 transition-all duration-1000 delay-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        © {new Date().getFullYear()} SYMX Systems. All rights reserved.
      </footer>

      <style jsx global>{`
        /* ── Logo Entrance ── */
        @keyframes logoEntrance {
          0% { 
            opacity: 0; 
            transform: scale(0.8) translateY(-20px); 
            filter: blur(10px);
          }
          60% { 
            opacity: 1; 
            transform: scale(1.02) translateY(0); 
            filter: blur(0);
          }
          100% { 
            transform: scale(1) translateY(0); 
            filter: blur(0);
          }
        }
        .animate-logo-entrance {
          animation: logoEntrance 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* ── Slow Pulse ── */
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.4; transform: scale(1.5); }
          50% { opacity: 0.7; transform: scale(1.6); }
        }
        .animate-pulse-slow {
          animation: pulseSlow 4s ease-in-out infinite;
        }

        /* ── Background Orbs ── */
        /* ── Background Image ── */
        .login-bg {
          position: absolute;
          inset: 0;
          background-image: url('/login-bg.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: bgSlowZoom 30s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes bgSlowZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        .login-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(2, 6, 18, 0.75) 0%,
            rgba(5, 15, 40, 0.6) 40%,
            rgba(10, 20, 50, 0.7) 100%
          );
          pointer-events: none;
        }

        /* ── Floating Particles ── */
        .login-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }
        .login-particle {
          position: absolute;
          bottom: -10px;
          background: rgba(120, 180, 255, 0.5);
          border-radius: 50%;
          animation: particleRise linear infinite;
        }
        @keyframes particleRise {
          0% { 
            transform: translateY(0) scale(0); 
            opacity: 0;
          }
          10% { 
            opacity: 1;
            transform: translateY(-10vh) scale(1);
          }
          90% {
            opacity: 0.3;
          }
          100% { 
            transform: translateY(-100vh) scale(0.5); 
            opacity: 0;
          }
        }

        /* ── Card ── */
        .login-card {
          background: linear-gradient(135deg, rgba(5, 12, 30, 0.85) 0%, rgba(8, 18, 45, 0.9) 100%);
          backdrop-filter: blur(50px) saturate(1.2);
          -webkit-backdrop-filter: blur(50px) saturate(1.2);
          border: 1px solid rgba(100, 160, 255, 0.1);
          padding: 32px;
          border-radius: 20px;
          box-shadow: 
            0 0 0 1px rgba(255, 255, 255, 0.04) inset,
            0 25px 60px -15px rgba(0, 0, 0, 0.6),
            0 0 100px -25px rgba(37, 99, 235, 0.15);
        }

        /* ── Input ── */
        .login-input {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          height: 48px;
          border-radius: 12px !important;
          color: #e4e4e7 !important;
          font-size: 14px;
          transition: all 0.3s ease !important;
        }
        .login-input:focus {
          border-color: rgba(59, 130, 246, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 0 20px -5px rgba(59, 130, 246, 0.2) !important;
          background: rgba(255, 255, 255, 0.07) !important;
        }
        .login-input::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
        }

        /* ── Button ── */
        .login-button {
          width: 100%;
          height: 48px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          color: white !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
          border-radius: 12px !important;
          border: none !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-shadow: 0 4px 15px -3px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.2) inset !important;
          cursor: pointer;
        }
        .login-button:hover:not(:disabled) {
          transform: translateY(-1px) !important;
          box-shadow: 0 8px 25px -5px rgba(37, 99, 235, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.3) inset !important;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
        }
        .login-button:active:not(:disabled) {
          transform: translateY(0) scale(0.98) !important;
        }
        .login-button:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
