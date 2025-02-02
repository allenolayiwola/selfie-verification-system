import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { Shield } from "lucide-react";
import { useEffect } from "react";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user) return null;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ID Verification System</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:flex flex-col justify-center bg-primary/5 p-12">
        <div className="space-y-4">
          <Shield className="w-12 h-12 text-primary" />
          <h2 className="text-3xl font-bold">Secure ID Verification</h2>
          <p className="text-muted-foreground">
            Our advanced ID verification system seamlessly authenticates users by integrating with Ghana's National Identification Authority (NIA) system. It ensures secure and reliable identity verification through facial recognition technology, making it ideal for businesses that require high security and regulatory compliance.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const { register, handleSubmit } = useForm<{username: string, password: string}>();

  return (
    <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" defaultValue="" {...register("username")} required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" defaultValue="" {...register("password")} required />
      </div>
      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
}