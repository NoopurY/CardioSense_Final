import { fail, ok, requireUser } from "@/lib/server/http";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  return ok({
    normal: { mean: 79.4, std: 8.1, confidence: [63.2, 95.6] },
    poisson: { lambda: 2.3, probabilities: [0.1, 0.23, 0.26, 0.2, 0.12, 0.06, 0.03] },
    t_distribution: { dof: 29, t_critical: 2.045, ci95: [76.4, 82.1] },
    chi_square: { statistic: 1.84, p_value: 0.39 },
  });
}
