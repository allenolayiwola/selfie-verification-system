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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import Navbar from "@/components/navbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#10B981", "#EF4444", "#F59E0B"]; // success, destructive, warning

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const { toast } = useToast();

  const { data: verifications } = useQuery<any[]>({
    queryKey: ["/api/verifications"],
  });

  const updateVerificationMutation = useMutation({
    mutationFn: async ({ id, status, response }: { id: number; status: string; response?: string }) => {
      const res = await apiRequest("PATCH", `/api/verifications/${id}`, { status, response });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifications"] });
      toast({
        title: "Verification updated",
        description: "The verification status has been updated successfully.",
      });
      setSelectedVerification(null);
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

  // Calculate statistics
  const totalVerifications = verifications?.length || 0;
  const statusCounts = verifications?.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Prepare data for charts
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Daily verification trend
  const dailyTrend = verifications?.reduce((acc, v) => {
    const date = new Date(v.createdAt).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trendData = Object.entries(dailyTrend || {}).map(([date, count]) => ({
    date,
    count,
  }));

  const handleVerificationAction = (verification: any, status: string) => {
    setSelectedVerification({ ...verification, newStatus: status });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Analytics Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalVerifications}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Approval Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {((statusCounts.approved || 0) / totalVerifications * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{statusCounts.pending || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Verification Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full flex items-center justify-center">
                <BarChart width={500} height={300} data={trendData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full flex items-center justify-center">
                <PieChart width={300} height={300}>
                  <Pie
                    data={statusData}
                    cx={150}
                    cy={150}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Records */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Merchant ID</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications?.map((verification) => (
                  <TableRow key={verification.id}>
                    <TableCell>
                      {new Date(verification.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{verification.userId}</TableCell>
                    <TableCell>{verification.merchantId}</TableCell>
                    <TableCell>{verification.pinNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          verification.status === "approved"
                            ? "success"
                            : verification.status === "rejected"
                            ? "destructive"
                            : "default"
                        }
                      >
                        {verification.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{verification.response || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedImage(verification.imageData)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {verification.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleVerificationAction(verification, "approved")
                              }
                            >
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleVerificationAction(verification, "rejected")
                              }
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Image Preview Dialog */}
      <AlertDialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <AlertDialogContent className="max-w-screen-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Verification Image</AlertDialogTitle>
          </AlertDialogHeader>
          {selectedImage && (
            <img
              src={`data:image/jpeg;base64,${selectedImage}`}
              alt="Verification"
              className="w-full rounded-lg"
            />
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Action Dialog */}
      <AlertDialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedVerification?.newStatus === "approved"
                ? "Approve Verification"
                : "Reject Verification"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {selectedVerification?.newStatus} this verification?
              {selectedVerification?.newStatus === "rejected" && (
                <textarea
                  className="mt-2 w-full h-24 p-2 border rounded-md"
                  placeholder="Enter rejection reason..."
                  onChange={(e) =>
                    setSelectedVerification({
                      ...selectedVerification,
                      response: e.target.value,
                    })
                  }
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                updateVerificationMutation.mutate({
                  id: selectedVerification.id,
                  status: selectedVerification.newStatus,
                  response: selectedVerification.response,
                });
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}