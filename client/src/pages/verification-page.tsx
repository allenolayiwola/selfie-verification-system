import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import WebcamCapture from "@/components/webcam-capture";
import VerificationForm from "@/components/verification-form";
import OnboardingTutorial from "@/components/onboarding-tutorial";
import Navbar from "@/components/navbar";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function VerificationPage() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  useEffect(() => {
    // Check if this is the user's first visit
    const tutorialCompleted = localStorage.getItem("tutorial-completed");
    if (!tutorialCompleted) {
      setShowTutorial(true);
    }
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/verify", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/verifications"] });
      if (user?.role === "guest") {
        setShowCompletionDialog(true);
      } else {
        toast({
          title: "Verification submitted",
          description: "Your verification has been submitted successfully.",
        });
        setLocation("/");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (formData: any) => {
    if (!capturedImage) {
      toast({
        title: "Photo required",
        description: "Please capture a photo before submitting",
        variant: "destructive",
      });
      return;
    }

    verifyMutation.mutate({
      ...formData,
      imageData: capturedImage, // Send the raw base64 data without splitting
    });
  };

  const handleCompletionClose = () => {
    setShowCompletionDialog(false);
    if (user?.role === "guest") {
      logoutMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {showTutorial && (
        <OnboardingTutorial onComplete={() => setShowTutorial(false)} />
      )}

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>ID/Photo Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-medium">
                {capturedImage ? "2. Review Photo" : "1. Capture Photo"}
              </h3>
              <WebcamCapture onCapture={setCapturedImage} />
            </div>

            {capturedImage && (
              <div className="space-y-2">
                <h3 className="font-medium">3. Enter Verification Details</h3>
                <VerificationForm
                  onSubmit={handleFormSubmit}
                  isLoading={verifyMutation.isPending}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion Dialog */}
      <AlertDialog open={showCompletionDialog} onOpenChange={handleCompletionClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verification Submitted Successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Thank you for submitting your verification. Our team will review your submission and process it accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={handleCompletionClose}>
            Close
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}