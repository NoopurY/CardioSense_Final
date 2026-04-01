import { fail, ok, requireUser } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel } from "@/lib/server/models";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const device = await DeviceModel.findOne({ _id: id, userId: auth.sub }).lean();
  if (!device) return fail("Device not found", 404);
  return ok(device);
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;
  const device = await DeviceModel.findOne({ _id: id, userId: auth.sub });
  if (!device) return fail("Device not found", 404);

  const body = await request.json();
  device.name = sanitizeText(body.name) || device.name;
  device.location = sanitizeText(body.location) || device.location;
  device.isActive = typeof body.is_active === "boolean" ? body.is_active : device.isActive;
  await device.save();

  return ok(device);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  await DeviceModel.deleteOne({ _id: id, userId: auth.sub });
  return ok({ deleted: true });
}
