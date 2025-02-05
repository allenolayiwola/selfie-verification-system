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

const verificationFormSchema = z.object({
  merchantId: z.string().min(1, "Merchant ID is required"),
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
      merchantId: "",
      pinNumber: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="merchantId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter merchant ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pinNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghana Card Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter Ghana Card number" {...field} />
              </FormControl>
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