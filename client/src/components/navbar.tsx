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
          <Link href="/">
            <a className="font-bold text-lg">Selfie Verification</a>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/">
            <a className="text-sm font-medium hover:text-primary">Dashboard</a>
          </Link>
          <Link href="/verify">
            <a className="text-sm font-medium hover:text-primary">New Verification</a>
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/admin">
                <a className="text-sm font-medium hover:text-primary">Admin Panel</a>
              </Link>
              <Link href="/users">
                <a className="text-sm font-medium hover:text-primary">User Management</a>
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
            <a className="flex flex-col items-center gap-1 text-xs font-medium">
              <Shield className="h-5 w-5" />
              Dashboard
            </a>
          </Link>
          <Link href="/verify">
            <a className="flex flex-col items-center gap-1 text-xs font-medium">
              <Camera className="h-5 w-5" />
              Verify
            </a>
          </Link>
          {user.role === "admin" && (
            <>
              <Link href="/admin">
                <a className="flex flex-col items-center gap-1 text-xs font-medium">
                  <Shield className="h-5 w-5" />
                  Admin
                </a>
              </Link>
              <Link href="/users">
                <a className="flex flex-col items-center gap-1 text-xs font-medium">
                  <Users className="h-5 w-5" />
                  Users
                </a>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}