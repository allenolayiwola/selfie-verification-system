import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Camera, LogOut, Users, LayoutDashboard, FileBarChart } from "lucide-react";

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

        <nav className="hidden md:flex items-center">
          <Link href="/">
            <span className="flex items-center gap-2 px-4 text-sm font-medium hover:text-primary">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </span>
          </Link>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Link href="/verify">
            <span className="flex items-center gap-2 px-4 text-sm font-medium hover:text-primary">
              <Camera className="h-4 w-4" />
              Verification
            </span>
          </Link>
          {user.role === "admin" && (
            <>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Link href="/users">
                <span className="flex items-center gap-2 px-4 text-sm font-medium hover:text-primary">
                  <Users className="h-4 w-4" />
                  User Management
                </span>
              </Link>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Link href="/admin">
                <span className="flex items-center gap-2 px-4 text-sm font-medium hover:text-primary">
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
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <LayoutDashboard className="h-5 w-5" />
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