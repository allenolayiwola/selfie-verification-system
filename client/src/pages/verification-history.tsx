import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Navbar from "@/components/navbar";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Download, 
  UserIcon, 
  Mail, 
  Building2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Define the VerificationRecord type based on the data returned from the API
interface VerificationRecord {
  id: number;
  userId: number;
  merchantId: string;
  pinNumber: string;
  status: "pending" | "approved" | "rejected";
  response: string;
  createdAt: string;
  username: string;
  fullName: string | null;
  department: string | null;
  email: string | null;
  userRole: string;
}

export default function VerificationHistoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Redirect non-admin users
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Only show for admin users
  if (!user || user.role !== "admin") return null;

  const { data: verifications, isLoading } = useQuery<VerificationRecord[]>({
    queryKey: ["/api/verifications"],
  });

  // Sort verifications by createdAt date in descending order (latest first)
  const sortedVerifications = verifications 
    ? [...verifications].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  // Filter verifications based on search query
  const filteredVerifications = sortedVerifications.filter(verification => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      verification.pinNumber.toLowerCase().includes(query) ||
      verification.username.toLowerCase().includes(query) ||
      (verification.fullName && verification.fullName.toLowerCase().includes(query)) ||
      (verification.department && verification.department.toLowerCase().includes(query)) ||
      (verification.email && verification.email.toLowerCase().includes(query)) ||
      verification.status.toLowerCase().includes(query)
    );
  });

  // Export verification history as CSV
  const exportCSV = () => {
    if (!sortedVerifications || sortedVerifications.length === 0) return;
    
    const headers = [
      "ID", "Date", "Username", "Full Name", "Department", 
      "Email", "Role", "PIN Number", "Status", "Response"
    ];
    
    const csvData = sortedVerifications.map(v => [
      v.id,
      format(new Date(v.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      v.username,
      v.fullName || '',
      v.department || '',
      v.email || '',
      v.userRole,
      v.pinNumber,
      v.status,
      v.response ? JSON.stringify(v.response).replace(/,/g, ' ') : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `verification-history-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Verification History</CardTitle>
                <CardDescription>
                  View all verification attempts across the system
                </CardDescription>
              </div>
              <Button 
                variant="outline"
                onClick={exportCSV}
                disabled={!sortedVerifications || sortedVerifications.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, PIN, department..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead>User Information</TableHead>
                    <TableHead>Ghana Card Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading verification history...
                      </TableCell>
                    </TableRow>
                  ) : filteredVerifications?.length ? (
                    filteredVerifications.map((verification) => (
                      <TableRow key={verification.id}>
                        <TableCell className="font-medium">
                          {format(new Date(verification.createdAt), 'PPp')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{verification.username}</span>
                              {verification.fullName && (
                                <span className="text-muted-foreground ml-1">
                                  ({verification.fullName})
                                </span>
                              )}
                            </div>
                            {verification.department && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span>{verification.department}</span>
                              </div>
                            )}
                            {verification.email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{verification.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{verification.pinNumber}</TableCell>
                        <TableCell>
                          <Badge variant={
                            verification.status === "approved" ? "success" :
                            verification.status === "rejected" ? "destructive" :
                            "default"
                          } className="flex items-center gap-1 min-w-[90px]">
                            {verification.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
                             verification.status === "rejected" ? <XCircle className="h-3.5 w-3.5" /> : 
                             <AlertCircle className="h-3.5 w-3.5" />}
                            {verification.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-sm hidden md:table-cell">
                          <div className="truncate text-xs text-muted-foreground font-mono">
                            {verification.response || "No response recorded"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "No matching verification records found" : "No verification records found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
