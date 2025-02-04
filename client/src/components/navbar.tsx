import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, Camera, LogOut, Users } from "lucide-react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();

  if (!user) return null;

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">
            <Link href="/">ID Verification System</Link>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/">
            <span className="text-sm font-medium hover:text-primary">Dashboard</span>
          </Link>
          <Link href="/verify">
            <span className="text-sm font-medium hover:text-primary">Verification</span>
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/users">
                <span className="text-sm font-medium hover:text-primary">User Management</span>
              </Link>
              <Link href="/admin">
                <span className="text-sm font-medium hover:text-primary">Reports</span>
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
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <Shield className="h-5 w-5" />
              Dashboard
            </span>
          </Link>
          <Link href="/verify">
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <Camera className="h-5 w-5" />
              Verify
            </span>
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/users">
                <span className="flex flex-col items-center gap-1 text-xs font-medium">
                  <Users className="h-5 w-5" />
                  Users
                </span>
              </Link>
              <Link href="/admin">
                <span className="flex flex-col items-center gap-1 text-xs font-medium">
                  <Shield className="h-5 w-5" />
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