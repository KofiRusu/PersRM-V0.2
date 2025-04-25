"use client";

import React, { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelType } from '@/lib/aiClient';

interface RouteGeneratorProps {
  onGenerated: (code: string) => void;
  selectedModel: ModelType;
}

export function RouteGenerator({ onGenerated, selectedModel }: RouteGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<string>("GET");
  const [endpoint, setEndpoint] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [requestData, setRequestData] = useState<string>("");
  const [responseFormat, setResponseFormat] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("basic");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!endpoint.trim()) {
      toast({
        title: "Endpoint required",
        description: "Please provide an endpoint path",
        variant: "destructive"
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what this API route should do",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/generate-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          endpoint: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
          description,
          requestData: requestData.trim() || null,
          responseFormat: responseFormat.trim() || null,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate route');
      }

      const data = await response.json();
      onGenerated(data.code);
      
      toast({
        title: "Route generated successfully",
        description: "Your API route has been created"
      });
    } catch (error) {
      toast({
        title: "Error generating route",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseExample = () => {
    setMethod("POST");
    setEndpoint("/api/users/register");
    setDescription("Register a new user with email, password, and name. Hash the password before storing. Return a success message and user ID on success.");
    setRequestData(`{
  "email": "string", // User's email address
  "password": "string", // Plain text password to be hashed
  "name": "string" // User's full name
}`);
    setResponseFormat(`{
  "success": boolean,
  "message": string,
  "userId": string // UUID of the created user
}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Route Generator</CardTitle>
        <CardDescription>
          Describe your API route and generate the code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="method">HTTP Method</Label>
              <Select
                value={method}
                onValueChange={setMethod}
              >
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint Path</Label>
              <Input
                id="endpoint"
                placeholder="/api/users"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this API route should do..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requestData">Request Data Structure (optional)</Label>
            <Textarea
              id="requestData"
              placeholder="Describe the expected request body format (JSON, TypeScript interface, etc.)"
              value={requestData}
              onChange={(e) => setRequestData(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="responseFormat">Response Format (optional)</Label>
            <Textarea
              id="responseFormat"
              placeholder="Describe the expected response format (JSON, TypeScript interface, etc.)"
              value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value)}
              rows={3}
            />
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Route'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 