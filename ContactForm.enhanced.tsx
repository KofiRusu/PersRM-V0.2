import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as z from 'zod';

// Form schema validation with Zod
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  subject: z.string().min(3, { message: "Subject is required" }),
  message: z.string().min(10, { message: "Message must be at least 10 characters" }),
  newsletter: z.boolean().optional(),
  privacyPolicy: z.boolean().refine(val => val === true, { 
    message: "You must agree to the privacy policy"
  })
});

type FormValues = z.infer<typeof formSchema>;

// File validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface ContactFormProps {
  className?: string;
  onSubmit?: (data: FormValues & { attachment?: File }) => Promise<void>;
}

export function ContactForm({ className = '', onSubmit }: ContactFormProps) {
  // Form state
  const [formValues, setFormValues] = useState<Partial<FormValues>>({
    name: '',
    email: '',
    subject: '',
    message: '',
    newsletter: false,
    privacyPolicy: false
  });
  
  // File handling
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [characterCount, setCharacterCount] = useState(0);
  
  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Effect to focus first error field on validation failure
  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0 && formRef.current) {
      const firstErrorField = formRef.current.querySelector(`[name="${errorKeys[0]}"]`) as HTMLElement;
      if (firstErrorField) {
        firstErrorField.focus();
      }
    }
  }, [errors]);
  
  // Validate a single field
  const validateField = (name: string, value: any): string | null => {
    try {
      const fieldSchema = formSchema.shape[name as keyof FormValues];
      fieldSchema.parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || 'Invalid input';
      }
      return 'An error occurred during validation';
    }
  };
  
  // Validate entire form
  const validateForm = (): boolean => {
    try {
      formSchema.parse(formValues);
      
      // File validation
      if (attachment) {
        if (attachment.size > MAX_FILE_SIZE) {
          setFileError('File size exceeds 5MB limit');
          return false;
        }
        if (!ACCEPTED_FILE_TYPES.includes(attachment.type)) {
          setFileError('File type not supported. Please upload PDF, JPG, or PNG');
          return false;
        }
      }
      
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox values
    const updatedValue = type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : value;
    
    // Update form state
    setFormValues(prev => ({
      ...prev,
      [name]: updatedValue
    }));
    
    // Update character count for message field
    if (name === 'message') {
      setCharacterCount(value.length);
    }
    
    // Mark field as touched
    if (!touched[name]) {
      setTouched(prev => ({
        ...prev,
        [name]: true
      }));
    }
    
    // Validate field
    const fieldError = validateField(name, updatedValue);
    setErrors(prev => ({
      ...prev,
      [name]: fieldError || undefined
    }));
  };
  
  // Handle file input changes
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setFileError(null);
    
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setFileError('File size exceeds 5MB limit');
        return;
      }
      
      // Validate file type
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        setFileError('File type not supported. Please upload PDF, JPG, or PNG');
        return;
      }
      
      setAttachment(file);
    } else {
      setAttachment(null);
    }
  };
  
  // Handle form blur events for validation
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    const fieldValue = type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : value;
    
    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    // Validate field
    const fieldError = validateField(name, fieldValue);
    setErrors(prev => ({
      ...prev,
      [name]: fieldError || undefined
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate entire form
    const isValid = validateForm();
    
    // Mark all fields as touched
    const allTouched = Object.keys(formValues).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    setTouched(allTouched);
    
    if (!isValid) {
      // Set focus on first error field
      const errorKeys = Object.keys(errors);
      if (errorKeys.length > 0 && formRef.current) {
        const firstErrorField = formRef.current.querySelector(`[name="${errorKeys[0]}"]`) as HTMLElement;
        if (firstErrorField) {
          firstErrorField.focus();
        }
      }
      return;
    }
    
    // Submit form
    setIsSubmitting(true);
    setSubmitStatus('idle');
    
    try {
      if (onSubmit) {
        await onSubmit({
          ...formValues as FormValues,
          attachment: attachment || undefined
        });
      } else {
        // Simulate API call if no onSubmit provided
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Reset form on success
      setFormValues({
        name: '',
        email: '',
        subject: '',
        message: '',
        newsletter: false,
        privacyPolicy: false
      });
      setAttachment(null);
      setCharacterCount(0);
      setTouched({});
      setSubmitStatus('success');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for file size display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <motion.div 
      className={`${className} p-6 rounded-lg shadow-md bg-white w-full max-w-3xl mx-auto`} 
      role="region" 
      aria-labelledby="contact-form-heading"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <h2 
          id="contact-form-heading" 
          className="text-2xl font-semibold text-gray-800 mb-2"
        >
          Contact Us
        </h2>
        <p className="text-gray-600">
          Fill out this form to get in touch with our team. We'll respond as soon as possible.
        </p>
      </header>

      {/* Success message */}
      <AnimatePresence>
        {submitStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-green-500 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clipRule="evenodd" 
                />
              </svg>
              <p className="text-green-700 font-medium">
                Your message has been sent successfully! We'll be in touch soon.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {submitStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-red-500 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                  clipRule="evenodd" 
                />
              </svg>
              <p className="text-red-700 font-medium">
                There was an error sending your message. Please try again later.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form 
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        noValidate
        aria-label="Contact form"
      >
        {/* Name field */}
        <div className="form-field">
          <label 
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formValues.name || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:outline-none
              ${errors.name && touched.name
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
              }`}
            aria-required="true"
            aria-invalid={errors.name && touched.name ? 'true' : 'false'}
            aria-describedby={errors.name && touched.name ? 'name-error' : undefined}
            placeholder="John Doe"
            disabled={isSubmitting}
          />
          <AnimatePresence>
            {errors.name && touched.name && (
              <motion.p
                id="name-error"
                className="mt-1 text-sm text-red-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                {errors.name}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Email field */}
        <div className="form-field">
          <label 
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formValues.email || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:outline-none
              ${errors.email && touched.email
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
              }`}
            aria-required="true"
            aria-invalid={errors.email && touched.email ? 'true' : 'false'}
            aria-describedby={errors.email && touched.email ? 'email-error' : undefined}
            placeholder="your.email@example.com"
            disabled={isSubmitting}
          />
          <AnimatePresence>
            {errors.email && touched.email && (
              <motion.p
                id="email-error"
                className="mt-1 text-sm text-red-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                {errors.email}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Subject field */}
        <div className="form-field md:col-span-2">
          <label 
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Subject <span className="text-red-500">*</span>
          </label>
          <select
            id="subject"
            name="subject"
            value={formValues.subject || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:outline-none
              ${errors.subject && touched.subject
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
              }`}
            aria-required="true"
            aria-invalid={errors.subject && touched.subject ? 'true' : 'false'}
            aria-describedby={errors.subject && touched.subject ? 'subject-error' : undefined}
            disabled={isSubmitting}
          >
            <option value="" disabled>Select a subject</option>
            <option value="General Inquiry">General Inquiry</option>
            <option value="Support">Support</option>
            <option value="Sales">Sales</option>
            <option value="Partnership">Partnership</option>
          </select>
          <AnimatePresence>
            {errors.subject && touched.subject && (
              <motion.p
                id="subject-error"
                className="mt-1 text-sm text-red-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                {errors.subject}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Message field */}
        <div className="form-field md:col-span-2">
          <label 
            htmlFor="message"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Message <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <textarea
              id="message"
              name="message"
              value={formValues.message || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:outline-none
                ${errors.message && touched.message
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
                }`}
              rows={5}
              aria-required="true"
              aria-invalid={errors.message && touched.message ? 'true' : 'false'}
              aria-describedby={
                errors.message && touched.message 
                  ? 'message-error message-counter' 
                  : 'message-counter'
              }
              placeholder="Enter your message here..."
              disabled={isSubmitting}
            />
            <span 
              id="message-counter" 
              className={`absolute bottom-2 right-2 text-xs ${
                characterCount > 500 ? 'text-red-500' : 'text-gray-500'
              }`}
              aria-live="polite"
            >
              {characterCount} characters
            </span>
          </div>
          <AnimatePresence>
            {errors.message && touched.message && (
              <motion.p
                id="message-error"
                className="mt-1 text-sm text-red-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                {errors.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* File attachment - Progressive disclosure */}
        <AnimatePresence>
          {formValues.message && formValues.message.length >= 10 && (
            <motion.div 
              className="form-field md:col-span-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <label
                htmlFor="attachment"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Attachment <span className="text-gray-500">(optional)</span>
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="file"
                  id="attachment"
                  name="attachment"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  aria-describedby={fileError ? 'file-error' : undefined}
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="attachment"
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Choose file
                </label>
                <span className="ml-3 text-sm text-gray-500">
                  {attachment ? attachment.name : 'No file chosen'}
                </span>
                {attachment && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({formatFileSize(attachment.size)})
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Accepted formats: PDF, JPG, PNG (max 5MB)
              </p>
              <AnimatePresence>
                {fileError && (
                  <motion.p
                    id="file-error"
                    className="mt-1 text-sm text-red-600"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                  >
                    {fileError}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Newsletter checkbox */}
        <div className="form-field md:col-span-2">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="newsletter"
                name="newsletter"
                type="checkbox"
                checked={formValues.newsletter || false}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="newsletter" className="font-medium text-gray-700">
                Subscribe to newsletter
              </label>
              <p className="text-gray-500">
                Get updates about our services and offers.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy policy checkbox */}
        <div className="form-field md:col-span-2">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="privacyPolicy"
                name="privacyPolicy"
                type="checkbox"
                checked={formValues.privacyPolicy || false}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                  ${errors.privacyPolicy && touched.privacyPolicy ? 'border-red-300' : ''}`}
                aria-required="true"
                aria-invalid={errors.privacyPolicy && touched.privacyPolicy ? 'true' : 'false'}
                aria-describedby={errors.privacyPolicy && touched.privacyPolicy ? 'privacy-error' : undefined}
                disabled={isSubmitting}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="privacyPolicy" className="font-medium text-gray-700">
                I agree to the privacy policy <span className="text-red-500">*</span>
              </label>
              <p className="text-gray-500">
                By submitting this form, you agree to our
                <a 
                  href="#" 
                  className="text-blue-600 hover:underline ml-1"
                  onClick={(e) => e.preventDefault()}
                >
                  privacy policy
                </a>.
              </p>
              <AnimatePresence>
                {errors.privacyPolicy && touched.privacyPolicy && (
                  <motion.p
                    id="privacy-error"
                    className="mt-1 text-sm text-red-600"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                  >
                    {errors.privacyPolicy}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Form feedback for screen readers */}
        <div 
          className="sr-only" 
          aria-live="polite" 
          id="form-feedback"
        >
          {isSubmitting ? 'Submitting your message...' : ''}
          {submitStatus === 'success' ? 'Your message has been sent successfully!' : ''}
          {submitStatus === 'error' ? 'There was an error sending your message.' : ''}
        </div>

        {/* Submit button */}
        <div className="form-field md:col-span-2 mt-4">
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-md font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sending...
              </div>
            ) : (
              'Send Message'
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
} 