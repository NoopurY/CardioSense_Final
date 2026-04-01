import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { AlertModel, DeviceModel, ECGRecordModel, PredictionModel, ReportModel, UserModel } from "@/lib/server/models";

export async function DELETE() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const records = await ECGRecordModel.find({ userId: auth.sub }).select("_id").lean();
  const recordIds = records.map((r) => r._id);

  await PredictionModel.deleteMany({ ecgRecordId: { $in: recordIds } });
  await AlertModel.deleteMany({ userId: auth.sub });
  await ReportModel.deleteMany({ userId: auth.sub });
  await ECGRecordModel.deleteMany({ userId: auth.sub });
  await DeviceModel.deleteMany({ userId: auth.sub });
  await UserModel.deleteOne({ _id: auth.sub });

  return ok({ deleted: true });
}
