import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrivateSidebar from "./private-sidebar";


export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const email = session.user?.email;
  if (!email) {
    redirect("/login?error=Callback");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userProfilePK: true },
  });

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  return (
    <div className="d-flex flex-column flex-md-row vh-100 overflow-hidden bg-light">
      <PrivateSidebar email={session.user?.email ?? "Signed user"} />
      <div className="flex-grow-1 overflow-auto px-3 px-md-4 py-3 py-md-4">
        <div className="container-xxl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
