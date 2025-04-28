import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Clock, Download, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";

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
  const [, setLocation] = useLocation();

  // Use the useAuth hook to get the user role
  const { user } = useAuth();
  
  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only administrators can view verification details",
        variant: "destructive"
      });
      setLocation("/history");
    }
  }, [user, setLocation, toast]);
  
  // Don't even attempt the query if user is not admin
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
  
  // Function to extract and display the base64 image from the API response
  const extractImageFromResponse = (jsonString: string): string | null => {
    try {
      const jsonData = JSON.parse(jsonString);
      
      // Check for the Ghana NIA API specific structure we've identified
      // data.person.biometricFeed.face.data
      if (jsonData.data && 
          jsonData.data.person && 
          jsonData.data.person.biometricFeed && 
          jsonData.data.person.biometricFeed.face &&
          jsonData.data.person.biometricFeed.face.data) {
        
        const imageData = jsonData.data.person.biometricFeed.face.data;
        const dataType = jsonData.data.person.biometricFeed.face.dataType?.toLowerCase() || 'jpeg';
        
        return `data:image/${dataType};base64,${imageData}`;
      }
      
      // Check other possible locations for the image data in the API response
      if (jsonData.image && typeof jsonData.image === 'string') {
        // If the API returns the image directly
        return jsonData.image.startsWith('data:image') 
          ? jsonData.image 
          : `data:image/jpeg;base64,${jsonData.image}`;
      } else if (jsonData.data && jsonData.data.image) {
        // If the API wraps the response in a data object
        return jsonData.data.image.startsWith('data:image') 
          ? jsonData.data.image 
          : `data:image/jpeg;base64,${jsonData.data.image}`;
      } else if (jsonData.response && jsonData.response.image) {
        // Another possible nesting structure
        return jsonData.response.image.startsWith('data:image') 
          ? jsonData.response.image 
          : `data:image/jpeg;base64,${jsonData.response.image}`;
      }
      
      // Check for face data using different key paths
      if (jsonData.biometricFeed && jsonData.biometricFeed.face && jsonData.biometricFeed.face.data) {
        const imageData = jsonData.biometricFeed.face.data;
        const dataType = jsonData.biometricFeed.face.dataType?.toLowerCase() || 'jpeg';
        return `data:image/${dataType};base64,${imageData}`;
      }
      
      // Check for other deep nested paths
      if (jsonData.person && jsonData.person.biometricData) {
        return `data:image/jpeg;base64,${jsonData.person.biometricData}`;
      }
      
      // Look for any property that might contain base64 data
      const searchForBase64 = (obj: any, depth = 0): string | null => {
        if (depth > 5) return null; // Limit search depth to prevent excessive recursion
        
        if (typeof obj === 'string' && 
            (obj.startsWith('data:image') || 
             obj.length > 500 && /^[A-Za-z0-9+/=]+$/.test(obj))) {
          return obj.startsWith('data:image') ? obj : `data:image/jpeg;base64,${obj}`;
        }
        
        if (typeof obj === 'object' && obj !== null) {
          for (const key in obj) {
            if (key === 'data' || key === 'image' || key === 'face' || key === 'biometricData' || key === 'biometricFeed') {
              const result = searchForBase64(obj[key], depth + 1);
              if (result) return result;
            }
          }
          
          // If we didn't find anything in the priority keys, search all keys
          for (const key in obj) {
            const result = searchForBase64(obj[key], depth + 1);
            if (result) return result;
          }
        }
        
        return null;
      };
      
      return searchForBase64(jsonData);
    } catch (e) {
      console.error("Error extracting image:", e);
      return null;
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
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => setLocation("/history")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Verification History
              </Button>
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
                <Button onClick={() => setLocation("/history")}>
                  Return to Verification History
                </Button>
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
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setLocation("/history")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Verification History
          </Button>
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
            <div className="grid grid-cols-1 gap-6">
              {/* Verification Image Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Verification Image</CardTitle>
                  <CardDescription>
                    Image used for identity verification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    {extractImageFromResponse(verification.response) ? (
                      <div className="rounded-md overflow-hidden border border-border">
                        <img 
                          src={extractImageFromResponse(verification.response)!} 
                          alt="Verification Image" 
                          className="max-w-full h-auto object-contain max-h-[300px]"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md">
                        <AlertCircle className="h-12 w-12 mb-2" />
                        <p>No image data found in the API response</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* API Response Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">API Response Data</CardTitle>
                  <CardDescription>
                    Raw data returned by the verification API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md overflow-auto max-h-[40vh]">
                    <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
                      {formatJsonResponse(verification.response)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}