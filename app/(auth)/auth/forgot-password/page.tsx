"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0);

  return (
    <Panel className="w-full max-w-md" title="Forgot Password" subtitle="OTP recovery workflow">
      {step === 0 && <Input label="Email" type="email" aria-label="Email" />}
      {step === 1 && <Input label="OTP" aria-label="OTP" />}
      {step === 2 && (
        <div className="grid gap-3">
          <Input label="New Password" type="password" aria-label="New Password" />
          <Input label="Confirm Password" type="password" aria-label="Confirm Password" />
        </div>
      )}
      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </Button>
        {step < 2 ? <Button onClick={() => setStep((s) => s + 1)}>Continue</Button> : <Button>Reset Password</Button>}
      </div>
      <div className="mt-4 ecg-line" />
    </Panel>
  );
}
