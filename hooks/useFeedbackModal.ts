import { useState } from 'react';

interface FeedbackState {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  isSuccess: boolean;
  setIsSuccess: (value: boolean) => void;
  resetState: () => void;
}

export function useFeedbackModal(): FeedbackState {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const openModal = () => {
    setIsOpen(true);
    setIsSuccess(false);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const resetState = () => {
    setIsSubmitting(false);
    setIsSuccess(false);
  };

  return {
    isOpen,
    openModal,
    closeModal,
    isSubmitting,
    setIsSubmitting,
    isSuccess,
    setIsSuccess,
    resetState,
  };
} 