import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Camera, LogOut, Users, LayoutDashboard, FileBarChart, History } from "lucide-react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();

  if (!user) return null;

  // Guest users only see the verification page
  if (user.role === "guest") {
    return (
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">
              ID Verification System
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">
            <Link href="/">ID Verification System</Link>
          </span>
        </div>

        <nav className="hidden md:flex items-center">
          <Link href="/">
            <span className="flex items-center gap-2 px-4 text-sm font-medium text-blue-600 hover:text-orange-500 transition-colors">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </span>
          </Link>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Link href="/verify">
            <span className="flex items-center gap-2 px-4 text-sm font-medium text-blue-600 hover:text-orange-500 transition-colors">
              <Camera className="h-4 w-4" />
              Verification
            </span>
          </Link>
          {user.role === "admin" && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Link href="/users">
                <span className="flex items-center gap-2 px-4 text-sm font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <Users className="h-4 w-4" />
                  User Management
                </span>
              </Link>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Link href="/history">
                <span className="flex items-center gap-2 px-4 text-sm font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <History className="h-4 w-4" />
                  Verification History
                </span>
              </Link>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Link href="/admin">
                <span className="flex items-center gap-2 px-4 text-sm font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <FileBarChart className="h-4 w-4" />
                  Reports
                </span>
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden md:inline-block">
            {user.username}
          </span>
          <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t">
        <nav className="container mx-auto px-4 py-2 flex justify-around">
          <Link href="/">
            <span className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 hover:text-orange-500 transition-colors">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </span>
          </Link>
          <Link href="/verify">
            <span className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 hover:text-orange-500 transition-colors">
              <Camera className="h-5 w-5" />
              Verify
            </span>
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/users">
                <span className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <Users className="h-5 w-5" />
                  Users
                </span>
              </Link>
              <Link href="/history">
                <span className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <History className="h-5 w-5" />
                  History
                </span>
              </Link>
              <Link href="/admin">
                <span className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 hover:text-orange-500 transition-colors">
                  <FileBarChart className="h-5 w-5" />
                  Reports
                </span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}