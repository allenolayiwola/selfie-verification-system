import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";

interface VerificationDetail {
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

export default function VerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const { toast } = useToast();

  // Use the useAuth hook to get the user role
  const { user } = useAuth();
  
  // Make sure we include the query function to set credentials properly
  const { data: verification, isLoading, error } = useQuery<VerificationDetail>({
    queryKey: [`/api/verifications/${id}`],
    enabled: !isNaN(id) && user?.role === "admin", // Only enable for admin users
    retry: 1, // Limit retries to avoid spamming the server
    queryFn: getQueryFn({ on401: "throw" }) // Explicitly set the query function
  });

  // Function to format JSON for display
  const formatJsonResponse = (jsonString: string) => {
    try {
      const jsonData = JSON.parse(jsonString);
      return JSON.stringify(jsonData, null, 2);
    } catch (e) {
      return jsonString;
    }
  };

  // Function to download verification data as JSON file
  const downloadVerificationData = () => {
    if (!verification) return;
    
    try {
      const jsonData = JSON.parse(verification.response);
      const dataStr = JSON.stringify(jsonData, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `verification-${verification.id}-${verification.username}.json`);
      linkElement.click();
      
      toast({
        title: "Download started",
        description: "Verification data is being downloaded.",
      });
    } catch (e) {
      toast({
        title: "Download failed",
        description: "Could not download verification data.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading verification details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !verification) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <Link href="/history">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Verification History
                </Button>
              </Link>
            </div>
            <Card className="border-destructive">
              <CardHeader className="bg-destructive/10">
                <CardTitle className="text-destructive">Error Loading Verification</CardTitle>
                <CardDescription>
                  Could not load the verification details. The verification may have been deleted or you may not have permission to view it.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p>{error?.message || "Unknown error"}</p>
              </CardContent>
              <CardFooter>
                <Link href="/history">
                  <Button>Return to Verification History</Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const statusIcon = {
    approved: <CheckCircle className="h-5 w-5 text-green-500" />,
    rejected: <XCircle className="h-5 w-5 text-red-500" />,
    pending: <Clock className="h-5 w-5 text-yellow-500" />
  };

  const statusColor = {
    approved: "bg-green-100 text-green-800 hover:bg-green-200",
    rejected: "bg-red-100 text-red-800 hover:bg-red-200",
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Verification History
            </Button>
          </Link>
          <Button 
            onClick={downloadVerificationData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Response Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Verification #{verification.id}</CardTitle>
                <CardDescription>
                  Created on {new Date(verification.createdAt).toLocaleString()}
                </CardDescription>
                <div className="mt-2">
                  <Badge 
                    className={statusColor[verification.status]}
                    variant="outline"
                  >
                    <div className="flex items-center gap-1">
                      {statusIcon[verification.status]}
                      <span className="capitalize">{verification.status}</span>
                    </div>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-medium text-lg mb-2">User Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Username:</span>
                    <p className="font-medium">{verification.username}</p>
                  </div>
                  {verification.fullName && (
                    <div>
                      <span className="text-muted-foreground">Full Name:</span>
                      <p className="font-medium">{verification.fullName}</p>
                    </div>
                  )}
                  {verification.department && (
                    <div>
                      <span className="text-muted-foreground">Department:</span>
                      <p className="font-medium">{verification.department}</p>
                    </div>
                  )}
                  {verification.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{verification.email}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Role:</span>
                    <p className="font-medium capitalize">{verification.userRole}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <h3 className="font-medium text-lg mb-2">Verification Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">PIN Number:</span>
                    <p className="font-medium">{verification.pinNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Merchant ID:</span>
                    <p className="font-medium text-xs break-all">{verification.merchantId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">API Response Data</CardTitle>
                <CardDescription>
                  Raw data returned by the verification API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-[60vh]">
                  <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
                    {formatJsonResponse(verification.response)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}