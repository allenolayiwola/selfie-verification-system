import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Camera, FileText, ShieldCheck, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/navbar";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect guest users to verification page
    if (user?.role === "guest") {
      setLocation("/verify");
    }
  }, [user, setLocation]);

  if (user?.role === "guest") return null;

  const { data: verifications } = useQuery<any[]>({ 
    queryKey: ["/api/user/verifications"]
  });

  // Calculate verification stats
  const stats = verifications?.reduce((acc, v) => {
    acc.total++;
    acc[v.status]++;
    return acc;
  }, { total: 0, approved: 0, rejected: 0, pending: 0 });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.rejected || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Start New Verification</CardTitle>
              <CardDescription>
                Take a photo and verify your identity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/verify">
                <Button className="w-full">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Verification
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Verification History</CardTitle>
                <CardDescription>
                  View your recent verification attempts
                </CardDescription>
              </div>
              {verifications?.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/history">View All</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {verifications?.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {v.status === "approved" ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : v.status === "rejected" ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="font-medium">Merchant ID: {v.merchantId}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={
                        v.status === "approved" ? "success" :
                        v.status === "rejected" ? "destructive" :
                        "default"
                      }>
                        {v.status}
                      </Badge>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {!verifications?.length && (
                  <div className="text-center py-4 text-muted-foreground">
                    No verification attempts yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}