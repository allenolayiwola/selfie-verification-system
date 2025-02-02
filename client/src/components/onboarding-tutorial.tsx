import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Selfie Verification",
    description: "Let's walk through the verification process together. We'll help you take the perfect selfie for verification.",
    highlight: null,
  },
  {
    title: "Face Detection",
    description: "Position your face within the circular guide. A green box will appear around your face when detected correctly.",
    highlight: ".face-guide",
  },
  {
    title: "Lighting Check",
    description: "Ensure you're in a well-lit area. The lighting indicator on the right will show when conditions are optimal.",
    highlight: ".lighting-status",
  },
  {
    title: "Liveness Detection",
    description: "Move your head slightly to confirm you're a real person. The liveness indicator will turn green when confirmed.",
    highlight: ".liveness-status",
  },
  {
    title: "Image Quality",
    description: "Follow the quality guidelines for the best results. Your face should be centered and at the right distance.",
    highlight: ".quality-status",
  },
  {
    title: "Ready to Verify",
    description: "Once all indicators are green, click the capture button to take your verification photo.",
    highlight: ".capture-button",
  },
];

interface OnboardingTutorialProps {
  onComplete: () => void;
}

export default function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Highlight the current element
    const highlightElement = TUTORIAL_STEPS[currentStep].highlight;
    if (highlightElement) {
      const element = document.querySelector(highlightElement);
      if (element) {
        element.classList.add("tutorial-highlight");
      }
    }

    return () => {
      // Clean up highlight
      if (highlightElement) {
        const element = document.querySelector(highlightElement);
        if (element) {
          element.classList.remove("tutorial-highlight");
        }
      }
    };
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
      onComplete();
      // Save tutorial completion to localStorage
      localStorage.setItem("tutorial-completed", "true");
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onComplete();
    localStorage.setItem("tutorial-completed", "true");
  };

  if (!isVisible) return null;

  const currentTutorialStep = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{currentTutorialStep.title}</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {currentTutorialStep.description}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleSkip}>
            Skip Tutorial
          </Button>
          <Button onClick={handleNext}>
            {currentStep === TUTORIAL_STEPS.length - 1 ? "Get Started" : "Next"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
