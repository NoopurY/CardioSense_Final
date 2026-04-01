import { ok } from "@/lib/server/http";

export async function GET(_req: Request, ctx: { params: Promise<{ device_id: string }> }) {
  const { device_id } = await ctx.params;
  return ok({
    endpoint: `/api/ws/ecg/${device_id}`,
    protocol: "websocket",
    note: "Use external realtime gateway in production. This route documents contract for clients.",
  });
}
