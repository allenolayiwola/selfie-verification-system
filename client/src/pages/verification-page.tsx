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

export default function VerificationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

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
      toast({
        title: "Verification submitted",
        description: "Your verification has been submitted successfully.",
      });
      setLocation("/");
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
      imageData: capturedImage.split(",")[1], // Remove data:image/jpeg;base64, prefix
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {showTutorial && (
        <OnboardingTutorial onComplete={() => setShowTutorial(false)} />
      )}

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Selfie Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-medium">1. Capture Photo</h3>
              <WebcamCapture onCapture={setCapturedImage} />
            </div>

            {capturedImage && (
              <div className="space-y-2">
                <h3 className="font-medium">2. Enter Verification Details</h3>
                <VerificationForm
                  onSubmit={handleFormSubmit}
                  isLoading={verifyMutation.isPending}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}