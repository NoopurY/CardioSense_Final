import { fail, ok, requireUser } from "@/lib/server/http";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  return ok({
    pearson_r: 0.73,
    spearman_r: 0.68,
    interpretation: "moderate to strong positive",
    points: Array.from({ length: 20 }, () => ({
      bpm: 60 + Math.random() * 50,
      hrv: 20 + Math.random() * 45,
    })),
  });
}
