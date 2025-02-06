import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const verificationFormSchema = z.object({
  pinNumber: z.string().min(1, "Ghana Card Number is required"),
});

type VerificationFormData = z.infer<typeof verificationFormSchema>;

interface VerificationFormProps {
  onSubmit: (data: VerificationFormData) => void;
  isLoading: boolean;
}

export default function VerificationForm({ onSubmit, isLoading }: VerificationFormProps) {
  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      pinNumber: "",
    },
  });

  const handleSubmit = (data: VerificationFormData) => {
    // Add fixed merchant ID to the form data
    onSubmit({
      ...data,
      merchantId: "5ce32d6e-2140-413a-935d-dbbb74c65439"
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="pinNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghana Card Number</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FormControl>
                      <Input 
                        placeholder="Enter your Ghana Card Number" 
                        {...field} 
                      />
                    </FormControl>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Expected format: GHA-xxxxxxxx-x</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Verifying..." : "Submit Verification"}
        </Button>
      </form>
    </Form>
  );
}