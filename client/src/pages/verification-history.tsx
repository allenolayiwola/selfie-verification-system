import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/navbar";
import { format } from "date-fns";

export default function VerificationHistoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect non-admin users
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Only show for admin users
  if (!user || user.role !== "admin") return null;

  const { data: verifications } = useQuery<any[]>({
    queryKey: ["/api/verifications"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Verification History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Merchant ID</TableHead>
                  <TableHead>Ghana Card Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response/Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications?.map((verification) => (
                  <TableRow key={verification.id}>
                    <TableCell>
                      {format(new Date(verification.createdAt), 'PPpp')}
                    </TableCell>
                    <TableCell>{verification.userId}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {verification.merchantId}
                    </TableCell>
                    <TableCell>{verification.pinNumber}</TableCell>
                    <TableCell>
                      <Badge variant={
                        verification.status === "approved" ? "success" :
                        verification.status === "rejected" ? "destructive" :
                        "default"
                      }>
                        {verification.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate text-muted-foreground">
                        {verification.response || "No response recorded"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!verifications?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No verification records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
