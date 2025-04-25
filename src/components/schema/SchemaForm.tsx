import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

interface SchemaFormProps {
  schemaId: string;
  versionId?: string;
  initialData?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  showMetadata?: boolean;
  aiAssistEnabled?: boolean;
}

export const SchemaForm: React.FC<SchemaFormProps> = ({
  schemaId,
  versionId,
  initialData = {},
  onSubmit,
  onCancel,
  readOnly = false,
  showMetadata = false,
  aiAssistEnabled = false,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [activeTab, setActiveTab] = useState<string>('form');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Fetch schema data using tRPC
  const { data: schema, isLoading, error } = trpc.schema.getSchema.useQuery({
    id: schemaId,
    versionId,
  });

  // AI assistance for field explanations
  const { mutate: getFieldExplanation } = trpc.ai.explainSchemaField.useMutation();

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(initialData);
    } else if (schema?.defaultValues) {
      setFormData(schema.defaultValues);
    }
  }, [initialData, schema]);

  if (isLoading) {
    return <SchemaFormSkeleton />;
  }

  if (error || !schema) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Error Loading Schema</CardTitle>
          <CardDescription>
            {error?.message || "Couldn't load the requested schema"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form data against the schema
    try {
      const validationSchema = buildValidationSchema(schema.jsonSchema);
      const validatedData = validationSchema.parse(formData);
      onSubmit?.(validatedData);
      toast({
        title: "Form submitted",
        description: "Your form has been successfully submitted.",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          const path = error.path.join('.');
          errors[path] = error.message;
        });
        setFieldErrors(errors);
        toast({
          title: "Validation Error",
          description: "Please check the form for errors.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAiAssist = (field: string) => {
    if (!aiAssistEnabled) return;
    
    getFieldExplanation({
      schemaId,
      fieldPath: field,
    }, {
      onSuccess: (data) => {
        toast({
          title: `About "${schema.jsonSchema.properties[field]?.title || field}"`,
          description: data.explanation,
        });
      }
    });
  };

  // Build the form fields based on the schema
  const renderFormFields = () => {
    if (!schema.jsonSchema.properties) {
      return <p>No fields defined in this schema.</p>;
    }

    return Object.entries(schema.jsonSchema.properties).map(([key, field]: [string, any]) => {
      const fieldType = field.type;
      const isRequired = schema.jsonSchema.required?.includes(key) || false;
      const hasError = !!fieldErrors[key];

      return (
        <div key={key} className="mb-4">
          <div className="flex items-center justify-between">
            <Label 
              htmlFor={key}
              className={`font-medium ${hasError ? 'text-destructive' : ''}`}
            >
              {field.title || key}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            
            {aiAssistEnabled && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={() => handleAiAssist(key)}
                className="h-6 w-6 p-0"
              >
                <span className="sr-only">Get AI explanation</span>
                <span className="text-muted-foreground">?</span>
              </Button>
            )}
          </div>
          
          {field.description && (
            <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
          )}
          
          {renderFieldByType(key, field, fieldType)}
          
          {hasError && (
            <p className="text-xs text-destructive mt-1">{fieldErrors[key]}</p>
          )}
        </div>
      );
    });
  };

  const renderFieldByType = (key: string, field: any, type: string) => {
    const value = formData[key];
    
    switch (type) {
      case 'string':
        if (field.enum) {
          return (
            <Select
              value={value || ''}
              onValueChange={(val) => handleFieldChange(key, val)}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={field.placeholder || `Select ${field.title || key}`} />
              </SelectTrigger>
              <SelectContent>
                {field.enum.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        } else if (field.format === 'textarea') {
          return (
            <Textarea
              id={key}
              value={value || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={field.placeholder || ''}
              className="w-full mt-1"
              disabled={readOnly}
              rows={field.rows || 3}
            />
          );
        }
        return (
          <Input
            id={key}
            type={field.format === 'password' ? 'password' : 'text'}
            value={value || ''}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            placeholder={field.placeholder || ''}
            className="w-full mt-1"
            disabled={readOnly}
          />
        );
      
      case 'number':
      case 'integer':
        return (
          <Input
            id={key}
            type="number"
            value={value?.toString() || ''}
            onChange={(e) => handleFieldChange(key, e.target.valueAsNumber)}
            placeholder={field.placeholder || ''}
            className="w-full mt-1"
            min={field.minimum}
            max={field.maximum}
            step={field.multipleOf || 1}
            disabled={readOnly}
          />
        );
      
      case 'boolean':
        return (
          <div className="flex items-center space-x-2 mt-1">
            <Switch
              id={key}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(key, checked)}
              disabled={readOnly}
            />
            <Label htmlFor={key}>{value ? 'Yes' : 'No'}</Label>
          </div>
        );
      
      case 'array':
        if (field.items?.enum) {
          if (field.uniqueItems) {
            // Checkbox group for multi-select
            return (
              <div className="space-y-2 mt-1">
                {field.items.enum.map((option: string) => {
                  const values = value || [];
                  return (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${key}-${option}`}
                        checked={values.includes(option)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleFieldChange(key, [...(values || []), option]);
                          } else {
                            handleFieldChange(
                              key,
                              values.filter((val: string) => val !== option)
                            );
                          }
                        }}
                        disabled={readOnly}
                      />
                      <Label htmlFor={`${key}-${option}`}>{option}</Label>
                    </div>
                  );
                })}
              </div>
            );
          } else {
            // Radio group for single select from multiple options
            return (
              <RadioGroup
                value={value || ''}
                onValueChange={(val) => handleFieldChange(key, val)}
                className="mt-1"
                disabled={readOnly}
              >
                {field.items.enum.map((option: string) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${key}-${option}`} />
                    <Label htmlFor={`${key}-${option}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            );
          }
        }
        return <p className="text-sm text-muted-foreground mt-1">Complex array type not supported in this view.</p>;
      
      case 'object':
        return <p className="text-sm text-muted-foreground mt-1">Nested object not supported in this view.</p>;
      
      default:
        return <p className="text-sm text-muted-foreground mt-1">Unsupported field type: {type}</p>;
    }
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="form">Form View</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          {showMetadata && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="form" className="pt-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>{schema.name}</CardTitle>
                {schema.description && (
                  <CardDescription>{schema.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {renderFormFields()}
                
                {!readOnly && (
                  <div className="flex justify-end space-x-2 mt-6">
                    {onCancel && (
                      <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                      </Button>
                    )}
                    <Button type="submit">Submit</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </TabsContent>
        
        <TabsContent value="json" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle>JSON Data</CardTitle>
              <CardDescription>Raw form data in JSON format</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-secondary p-4 rounded-md overflow-auto max-h-[500px]">
                {JSON.stringify(formData, null, 2)}
              </pre>
              
              {!readOnly && (
                <div className="flex justify-end space-x-2 mt-6">
                  {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  )}
                  <Button onClick={handleSubmit}>Submit</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {showMetadata && (
          <TabsContent value="metadata" className="pt-2">
            <Card>
              <CardHeader>
                <CardTitle>Schema Metadata</CardTitle>
                <CardDescription>Technical information about this schema</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Schema ID</dt>
                    <dd>{schema.id}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Version</dt>
                    <dd>{schema.version}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Created By</dt>
                    <dd>{schema.createdBy?.name || 'Unknown'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Created At</dt>
                    <dd>{new Date(schema.createdAt).toLocaleString()}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Last Modified</dt>
                    <dd>{new Date(schema.updatedAt).toLocaleString()}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                    <dd>{schema.status}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// Helper function to build a Zod validation schema from JSON Schema
const buildValidationSchema = (jsonSchema: any): z.ZodType<any> => {
  let schema: z.ZodType<any> = z.any();
  
  if (!jsonSchema.properties) {
    return schema;
  }
  
  const schemaMap: Record<string, z.ZodType<any>> = {};
  
  Object.entries(jsonSchema.properties).forEach(([key, field]: [string, any]) => {
    let fieldSchema: z.ZodType<any>;
    
    switch (field.type) {
      case 'string':
        fieldSchema = z.string();
        if (field.minLength) fieldSchema = fieldSchema.min(field.minLength);
        if (field.maxLength) fieldSchema = fieldSchema.max(field.maxLength);
        if (field.pattern) fieldSchema = fieldSchema.regex(new RegExp(field.pattern));
        if (field.format === 'email') fieldSchema = fieldSchema.email();
        if (field.format === 'uri') fieldSchema = fieldSchema.url();
        break;
        
      case 'number':
      case 'integer':
        fieldSchema = field.type === 'integer' ? z.number().int() : z.number();
        if (field.minimum !== undefined) fieldSchema = fieldSchema.min(field.minimum);
        if (field.maximum !== undefined) fieldSchema = fieldSchema.max(field.maximum);
        break;
        
      case 'boolean':
        fieldSchema = z.boolean();
        break;
        
      case 'array':
        fieldSchema = z.array(z.any());
        if (field.minItems) fieldSchema = fieldSchema.min(field.minItems);
        if (field.maxItems) fieldSchema = fieldSchema.max(field.maxItems);
        break;
        
      case 'object':
        fieldSchema = z.record(z.any());
        break;
        
      default:
        fieldSchema = z.any();
    }
    
    // Make optional if not required
    if (!jsonSchema.required?.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }
    
    schemaMap[key] = fieldSchema;
  });
  
  return z.object(schemaMap);
};

// Loading skeleton for the SchemaForm
const SchemaFormSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3 mt-2" />
    </CardHeader>
    <CardContent>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-6">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end space-x-2 mt-6">
        <Skeleton className="h-10 w-24" />
      </div>
    </CardContent>
  </Card>
);

export default SchemaForm; 