"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Logic for dynamic login: Fetch users and find the matching one
      const response = await fetch("/api/admin/users");
      const users = await response.json();
      
      const foundUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      
      if (!foundUser) {
        toast.error("Invalid credentials or user not found");
        setIsLoading(false);
        return;
      }

      // Security layer: salt and base64 for browser memory storage
      const salt = "vida_buddies_secret_salt";
      const userData = {
        id: foundUser._id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.AppRole || "Manager",
        avatar: foundUser.profilePicture || "/logo.png",
        timestamp: Date.now(),
        authorized: true
      };
      
      const encodedSession = btoa(JSON.stringify(userData) + salt);
      sessionStorage.setItem("vb_auth_token", encodedSession);
      
      toast.success(`Welcome back, ${foundUser.name}`);
      router.push("/dashboard");
    } catch (err) {
      console.error("Authentication error:", err);
      toast.error("System error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="relative group animate-float">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <Image
              src="/logo.png"
              alt="Logo"
              width={100}
              height={100}
              className="relative object-contain w-24 h-24 drop-shadow-2xl transition-transform duration-500 hover:scale-110"
              priority
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-zinc-500 mt-2 text-sm font-light">
            Enter your credentials to access your account
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-widest font-semibold ml-1">
                Email Address
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="bg-zinc-950/50 border-zinc-800 h-12 pl-11 focus:ring-1 focus:ring-primary/50 transition-all rounded-xl text-zinc-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-widest font-semibold ml-1">
                  Password
                </Label>
                <a href="#" className="text-[11px] text-zinc-500 hover:text-primary transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-zinc-950/50 border-zinc-800 h-12 pl-11 pr-11 focus:ring-1 focus:ring-primary/50 transition-all rounded-xl text-zinc-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
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
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
            >
              Log In
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-zinc-500 text-xs">
              Don't have an account?{" "}
              <a href="#" className="text-primary hover:underline font-semibold">
                Contact your administrator
              </a>
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-12 mb-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-medium z-10">
        © {new Date().getFullYear()} Vida Buddies. All rights reserved.
      </footer>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
