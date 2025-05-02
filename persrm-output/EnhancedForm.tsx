import React from 'react';
import { motion } from 'framer-motion';

interface EnhancedFormProps {
  className?: string;
  onSubmit: (data: any) => void;
  initialValues?: Record<string, any>;
}

export function EnhancedForm({ className = '', onSubmit, initialValues = {} }: EnhancedFormProps) {
  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={"form w-full p-4 md:p-6 max-w-md mx-auto p-6 border border-gray-200 rounded-lg shadow-sm " + className} onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);
      onSubmit(data);
    }}>
      {/* Basic form structure */}
      <div className="form-fields space-y-4 mb-6">
        {/* Form fields would be added here */}
      </div>
      <div aria-live="polite" id="form-feedback" className="sr-only"></div>
      <div className="form-actions">
        <button type="submit" aria-describedby="form-feedback" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 transition-colors duration-200">Submit</button>
      </div>
    </motion.form>
  );
}
