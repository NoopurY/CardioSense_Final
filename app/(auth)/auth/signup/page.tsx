"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";

const steps = ["Personal", "Medical", "Device", "Password"];

interface FormData {
  name: string;
  email: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  deviceId: string;
  sensorType: string;
  password: string;
  confirmPassword: string;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["", "text-rose-400", "text-yellow-400", "text-emerald-400", "text-cyan-300"];
  return (
    <div className="flex items-center gap-2 mt-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all ${
            i <= score
              ? score === 1
                ? "bg-rose-400"
                : score === 2
                  ? "bg-yellow-400"
                  : score === 3
                    ? "bg-emerald-400"
                    : "bg-cyan-300"
              : "bg-slate-700"
          }`}
        />
      ))}
      <span className={`text-xs ${colors[score]}`}>{labels[score]}</span>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [stepError, setStepError] = useState("");

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    deviceId: "",
    sensorType: "",
    password: "",
    confirmPassword: "",
  });

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setStepError("");
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.name.trim()) { setStepError("Full name is required."); return false; }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setStepError("A valid email is required."); return false;
      }
    }
    if (step === 3) {
      if (form.password.length < 8) { setStepError("Password must be at least 8 characters."); return false; }
      if (form.password !== form.confirmPassword) { setStepError("Passwords do not match."); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStepError("");
    setStep((s) => Math.min(3, s + 1));
  };

  const createAccount = async () => {
    if (!validateStep()) return;
    setServerError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          dob: form.dob,
          gender: form.gender,
          bloodGroup: form.bloodGroup,
          deviceId: form.deviceId,
          sensorType: form.sensorType,
        }),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error ?? "Failed to create account. Please try again.");
      }
    } catch {
      setServerError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Panel className="w-full max-w-xl" title="Create Account" subtitle="Set up your CardioSense profile">
      {/* Step indicator */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-all ${
              i < step
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                : i === step
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-100 shadow-[0_0_8px_rgba(0,212,255,0.3)]"
                  : "border-slate-700 text-slate-500"
            }`}
          >
            {i < step ? "✓" : i + 1}. {s}
          </div>
        ))}
      </div>

      <div className="grid gap-3 min-h-[220px]">
        {/* Step 0: Personal */}
        {step === 0 && (
          <>
            <Input
              label="Full Name *"
              id="signup-name"
              aria-label="Full Name"
              value={form.name}
              onChange={set("name")}
              autoComplete="name"
            />
            <Input
              label="Email *"
              type="email"
              id="signup-email"
              aria-label="Email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
            />
            <Input
              label="Date of Birth"
              type="date"
              id="signup-dob"
              aria-label="Date of Birth"
              value={form.dob}
              onChange={set("dob")}
            />
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-300">Gender</label>
              <select
                id="signup-gender"
                value={form.gender}
                onChange={set("gender")}
                className="rounded-lg border border-[#0d4f8c] bg-[#071e35] px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </>
        )}

        {/* Step 1: Medical */}
        {step === 1 && (
          <>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-300">Blood Group</label>
              <select
                id="signup-blood-group"
                value={form.bloodGroup}
                onChange={set("bloodGroup")}
                className="rounded-lg border border-[#0d4f8c] bg-[#071e35] px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Select blood group</option>
                {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 text-xs text-slate-400">
              <p className="mb-1 text-slate-300 font-medium">Medical History</p>
              <p>You can update your conditions, medications, and allergies from your Profile page after signing up.</p>
            </div>
          </>
        )}

        {/* Step 2: Device */}
        {step === 2 && (
          <>
            <Input
              label="ESP32 Device ID (optional)"
              id="signup-device-id"
              aria-label="ESP32 Device ID"
              placeholder="e.g. ESP32-A1B2C3"
              value={form.deviceId}
              onChange={set("deviceId")}
            />
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-300">Sensor Type</label>
              <select
                id="signup-sensor-type"
                value={form.sensorType}
                onChange={set("sensorType")}
                className="rounded-lg border border-[#0d4f8c] bg-[#071e35] px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Select sensor</option>
                <option value="AD8232">AD8232 ECG Sensor</option>
                <option value="MAX30102">MAX30102 Pulse Oximeter</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="rounded-lg border border-cyan-800/40 bg-cyan-900/10 p-3 text-xs text-cyan-300/80">
              You can skip device registration for now and add it later from the Device page.
            </div>
          </>
        )}

        {/* Step 3: Password */}
        {step === 3 && (
          <>
            <div className="grid gap-1">
              <Input
                label="Password *"
                type="password"
                id="signup-password"
                aria-label="Password"
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
              />
              <PasswordStrength password={form.password} />
            </div>
            <Input
              label="Confirm Password *"
              type="password"
              id="signup-confirm-password"
              aria-label="Confirm Password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              autoComplete="new-password"
            />
          </>
        )}
      </div>

      {/* Validation error */}
      {stepError && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {stepError}
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {serverError}
        </div>
      )}

      <div className="mt-5 flex justify-between items-center">
        <Button variant="ghost" onClick={() => { setStepError(""); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0 || isLoading}>
          ← Back
        </Button>
        {step < 3 ? (
          <Button onClick={nextStep}>Next →</Button>
        ) : (
          <Button onClick={createAccount} disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Creating account…
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
          Sign in
        </Link>
      </p>
    </Panel>
  );
}
