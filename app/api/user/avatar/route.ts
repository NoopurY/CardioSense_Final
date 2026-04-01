import { fail, ok, requireUser } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const body = await request.json();
  const avatar = sanitizeText(body.avatar_url);

  const user = await UserModel.findOne({ _id: auth.sub });
  if (!user) return fail("User not found", 404);

  user.avatarUrl = avatar;
  await user.save();
  return ok({ avatar_url: user.avatarUrl });
}
