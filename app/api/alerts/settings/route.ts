import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { AlertSettingsModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const settings: any = await AlertSettingsModel.findOneAndUpdate(
    { userId: auth.sub },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return ok({
    bpm_high: settings?.bpmHigh ?? 120,
    bpm_low: settings?.bpmLow ?? 50,
    spo2_low: settings?.spo2Low ?? 92,
    hrv_low: settings?.hrvLow ?? 22,
    email_alerts: settings?.emailAlerts ?? true,
    push_alerts: settings?.pushAlerts ?? true,
  });
}

export async function PUT(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const body = await request.json();

  const updated: any = await AlertSettingsModel.findOneAndUpdate(
    { userId: auth.sub },
    {
      bpmHigh: Number(body.bpm_high ?? 120),
      bpmLow: Number(body.bpm_low ?? 50),
      spo2Low: Number(body.spo2_low ?? 92),
      hrvLow: Number(body.hrv_low ?? 22),
      emailAlerts: Boolean(body.email_alerts ?? true),
      pushAlerts: Boolean(body.push_alerts ?? true),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return ok({
    bpm_high: updated?.bpmHigh,
    bpm_low: updated?.bpmLow,
    spo2_low: updated?.spo2Low,
    hrv_low: updated?.hrvLow,
    email_alerts: updated?.emailAlerts,
    push_alerts: updated?.pushAlerts,
  });
}
