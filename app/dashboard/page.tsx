// /dashboard — role-aware home. Each role gets a dedicated layout
// so the right KPIs and quick actions show up at a glance.
import { auth } from "@/auth";
import { isRole } from "@/lib/role";
import StudentDashboard from "./StudentDashboard";
import InstructorDashboard from "./InstructorDashboard";
import ManagerDashboard from "./ManagerDashboard";
import AdminDashboard from "./AdminDashboard";

export const metadata = { title: "Dashboard · Bootcamp LMS" };

export default async function DashboardHome() {
  const session = await auth();
  const userId = session!.user.id;
  const name = session!.user.name ?? "";
  const role = isRole(session!.user.role) ? session!.user.role : "STUDENT";

  switch (role) {
    case "STUDENT":    return <StudentDashboard userId={userId} name={name} />;
    case "INSTRUCTOR": return <InstructorDashboard userId={userId} name={name} />;
    case "MANAGER":    return <ManagerDashboard name={name} />;
    case "ADMIN":      return <AdminDashboard name={name} />;
  }
}
