import React from 'react';

interface TestFormProps {
  className?: string;
  onSubmit: (data: any) => void;
  initialValues?: Record<string, any>;
}

export function TestForm({ className = '', onSubmit, initialValues = {} }: TestFormProps) {
  return (
    <form className={"form " + className} onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);
      onSubmit(data);
    }}>
      {/* Basic form structure */}
      <div className="form-fields">
        {/* Form fields would be added here */}
      </div>
      <div className="form-actions">
        <button type="submit">Submit</button>
      </div>
    </form>
  );
}
