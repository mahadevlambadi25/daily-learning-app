import { requirePageUser } from "@/lib/auth/session";
import { getLearningStats } from "@/server/lessons";
import { AppHeader, BottomNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const stats = await getLearningStats(user.id, user.profile.timezone);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader user={{ name: user.profile.displayName, email: user.email, isAdmin: user.isAdmin, streak: stats.streak }} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-16">
        {children}
      </main>
      <div className="hidden md:block">
        <SiteFooter compact />
      </div>
      <BottomNav />
    </div>
  );
}
