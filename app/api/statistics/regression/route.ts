import { fail, ok, requireUser } from "@/lib/server/http";

export async function GET() {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  return ok({
    first_degree: { equation: "y = 0.54x + 71.3", r2: 0.64 },
    second_degree: { equation: "y = 0.01x^2 + 0.42x + 18", r2: 0.58 },
    covariance_matrix: [
      [1.0, 0.48, -0.12, 0.22, 0.3],
      [0.48, 1.0, -0.2, 0.39, 0.41],
      [-0.12, -0.2, 1.0, -0.06, -0.04],
      [0.22, 0.39, -0.06, 1.0, 0.27],
      [0.3, 0.41, -0.04, 0.27, 1.0],
    ],
  });
}
