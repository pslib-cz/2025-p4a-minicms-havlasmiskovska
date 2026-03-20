"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toValidProfilePK(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function completeRegistration(formData: FormData) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    redirect("/login");
  }

  const userProfilePK = toValidProfilePK(formData.get("userProfilePK"));
  if (userProfilePK === null) {
    redirect("/register?error=InvalidProfilePK");
  }

  const name = String(formData.get("name") ?? "").trim();

  try {
    await prisma.user.update({
      where: { email },
      data: {
        userProfilePK,
        name: name.length > 0 ? name : null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect("/register?error=ProfileInUse");
    }

    redirect("/register?error=SaveFailed");
  }

  redirect("/private/dashboard");
}
