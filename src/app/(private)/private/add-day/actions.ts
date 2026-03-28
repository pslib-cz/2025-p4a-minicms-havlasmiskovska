"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NumberMode = "int" | "float";

function parseNumberField(value: FormDataEntryValue | null, mode: NumberMode) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return null;
  }

  const parsed = mode === "int" ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function parseDateField(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeField(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function saveDay(formData: FormData) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[saveDay] Failed to get session:", error);
    redirect("/private/add-day?error=DatabaseError");
  }

  const email = session?.user?.email;

  if (!email) {
    redirect("/private/add-day?error=NotAuthenticated");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: { userProfilePK: true },
    });
  } catch (error) {
    console.error("[saveDay] Failed to query user:", error);
    redirect("/private/add-day?error=DatabaseError");
  }

  if (!user?.userProfilePK) {
    redirect("/register?error=InvalidProfilePK");
  }

  const pkDate = parseDateField(formData.get("pk_date"));
  if (!pkDate) {
    redirect("/private/add-day?error=InvalidDate");
  }

  const key = {
    pk_date: pkDate,
    userProfilePK: user.userProfilePK,
  };

  try {
    await prisma.bodyBattery.upsert({
      where: { pk_date_userProfilePK: key },
      update: {
        chargedValue: parseNumberField(formData.get("chargedValue"), "int"),
        drainedValue: parseNumberField(formData.get("drainedValue"), "int"),
        highest_statTimestamp: parseDateTimeField(formData.get("highest_statTimestamp")),
        highest_statsValue: parseNumberField(formData.get("highest_statsValue"), "int"),
        lowest_statTimestamp: parseDateTimeField(formData.get("lowest_statTimestamp")),
        lowest_statsValue: parseNumberField(formData.get("lowest_statsValue"), "int"),
        sleepend_statTimestamp: parseDateTimeField(formData.get("sleepend_statTimestamp")),
        sleepend_statsValue: parseNumberField(formData.get("sleepend_statsValue"), "int"),
        sleepstart_statTimestamp: parseDateTimeField(formData.get("sleepstart_statTimestamp")),
        sleepstart_statsValue: parseNumberField(formData.get("sleepstart_statsValue"), "int"),
      },
      create: {
        ...key,
        chargedValue: parseNumberField(formData.get("chargedValue"), "int"),
        drainedValue: parseNumberField(formData.get("drainedValue"), "int"),
        highest_statTimestamp: parseDateTimeField(formData.get("highest_statTimestamp")),
        highest_statsValue: parseNumberField(formData.get("highest_statsValue"), "int"),
        lowest_statTimestamp: parseDateTimeField(formData.get("lowest_statTimestamp")),
        lowest_statsValue: parseNumberField(formData.get("lowest_statsValue"), "int"),
        sleepend_statTimestamp: parseDateTimeField(formData.get("sleepend_statTimestamp")),
        sleepend_statsValue: parseNumberField(formData.get("sleepend_statsValue"), "int"),
        sleepstart_statTimestamp: parseDateTimeField(formData.get("sleepstart_statTimestamp")),
        sleepstart_statsValue: parseNumberField(formData.get("sleepstart_statsValue"), "int"),
      },
    });

    await prisma.respiration.upsert({
      where: { pk_date_userProfilePK: key },
      update: {
        avgWakingRespirationValue: parseNumberField(formData.get("avgWakingRespirationValue"), "float"),
        highestRespirationValue: parseNumberField(formData.get("highestRespirationValue"), "float"),
        lowestRespirationValue: parseNumberField(formData.get("lowestRespirationValue"), "float"),
      },
      create: {
        ...key,
        avgWakingRespirationValue: parseNumberField(formData.get("avgWakingRespirationValue"), "float"),
        highestRespirationValue: parseNumberField(formData.get("highestRespirationValue"), "float"),
        lowestRespirationValue: parseNumberField(formData.get("lowestRespirationValue"), "float"),
      },
    });

    await prisma.stress.upsert({
      where: { pk_date_userProfilePK: key },
      update: {
        awake_averageStressLevel: parseNumberField(formData.get("awake_averageStressLevel"), "float"),
        awake_averageStressLevelIntensity: parseNumberField(formData.get("awake_averageStressLevelIntensity"), "float"),
        awake_highDuration: parseNumberField(formData.get("awake_highDuration"), "int"),
        awake_lowDuration: parseNumberField(formData.get("awake_lowDuration"), "int"),
        awake_maxStressLevel: parseNumberField(formData.get("awake_maxStressLevel"), "int"),
        awake_mediumDuration: parseNumberField(formData.get("awake_mediumDuration"), "int"),
        awake_restDuration: parseNumberField(formData.get("awake_restDuration"), "int"),
        awake_stressDuration: parseNumberField(formData.get("awake_stressDuration"), "int"),
        awake_stressIntensityCount: parseNumberField(formData.get("awake_stressIntensityCount"), "int"),
        awake_totalDuration: parseNumberField(formData.get("awake_totalDuration"), "int"),
        awake_totalStressCount: parseNumberField(formData.get("awake_totalStressCount"), "int"),
        awake_totalStressIntensity: parseNumberField(formData.get("awake_totalStressIntensity"), "int"),
      },
      create: {
        ...key,
        awake_averageStressLevel: parseNumberField(formData.get("awake_averageStressLevel"), "float"),
        awake_averageStressLevelIntensity: parseNumberField(formData.get("awake_averageStressLevelIntensity"), "float"),
        awake_highDuration: parseNumberField(formData.get("awake_highDuration"), "int"),
        awake_lowDuration: parseNumberField(formData.get("awake_lowDuration"), "int"),
        awake_maxStressLevel: parseNumberField(formData.get("awake_maxStressLevel"), "int"),
        awake_mediumDuration: parseNumberField(formData.get("awake_mediumDuration"), "int"),
        awake_restDuration: parseNumberField(formData.get("awake_restDuration"), "int"),
        awake_stressDuration: parseNumberField(formData.get("awake_stressDuration"), "int"),
        awake_stressIntensityCount: parseNumberField(formData.get("awake_stressIntensityCount"), "int"),
        awake_totalDuration: parseNumberField(formData.get("awake_totalDuration"), "int"),
        awake_totalStressCount: parseNumberField(formData.get("awake_totalStressCount"), "int"),
        awake_totalStressIntensity: parseNumberField(formData.get("awake_totalStressIntensity"), "int"),
      },
    });
  } catch (error) {
    console.error("[saveDay] Failed to save data:", error);
    redirect("/private/add-day?error=DatabaseError");
  }

  revalidatePath("/private/dashboard");
  revalidatePath("/private/stress");
  revalidatePath("/private/body-battery");
  revalidatePath("/private/respiration");
  redirect("/private/add-day?success=1");
}
