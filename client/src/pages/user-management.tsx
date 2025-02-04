import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserEditor } from "@/components/user-editor";
import { UserPlus, PencilIcon, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Navbar from "@/components/navbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function UserManagementPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin"
  });

  const updateUserStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User status updated",
        description: "The user's status has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  // Group users by status
  const pendingUsers = users?.filter(u => u.status === "pending") || [];
  const activeUsers = users?.filter(u => u.status === "active") || [];
  const suspendedUsers = users?.filter(u => u.status === "suspended") || [];

  const handleStatusUpdate = (userId: number, status: string) => {
    updateUserStatus.mutate({ userId, status });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <UserEditor />
            </DialogContent>
          </Dialog>
        </div>

        {/* Pending Users Section */}
        {pendingUsers.length > 0 && (
          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Pending Activations ({pendingUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTable 
                users={pendingUsers}
                onUpdateStatus={handleStatusUpdate}
                isPending={updateUserStatus.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Active Users ({activeUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserTable 
              users={activeUsers}
              onUpdateStatus={handleStatusUpdate}
              isPending={updateUserStatus.isPending}
            />
          </CardContent>
        </Card>

        {/* Suspended Users */}
        {suspendedUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                Suspended Users ({suspendedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTable 
                users={suspendedUsers}
                onUpdateStatus={handleStatusUpdate}
                isPending={updateUserStatus.isPending}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function UserTable({ users, onUpdateStatus, isPending }: { 
  users: any[], 
  onUpdateStatus: (userId: number, status: string) => void,
  isPending: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Full Name</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.username}</TableCell>
            <TableCell>{user.fullName || '-'}</TableCell>
            <TableCell>{user.department || '-'}</TableCell>
            <TableCell>{user.email || '-'}</TableCell>
            <TableCell>
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={
                user.status === "active" ? "success" :
                user.status === "pending" ? "warning" :
                "destructive"
              }>
                {user.status}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(user.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {user.status === "pending" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onUpdateStatus(user.id, "active")}
                    disabled={isPending}
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </Button>
                )}
                {user.status === "active" && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onUpdateStatus(user.id, "suspended")}
                    disabled={isPending}
                  >
                    <XCircle className="w-4 h-4 text-destructive" />
                  </Button>
                )}
                {user.status === "suspended" && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onUpdateStatus(user.id, "active")}
                    disabled={isPending}
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <UserEditor user={user} />
                  </DialogContent>
                </Dialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}