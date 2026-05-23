import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import type { Portfolio } from '../../types/portfolio';

/**
 * Modal form for creating/editing portfolios.
 * Captures name, description, and initial balance.
 * The planId is auto-set from the active plan.
 *
 * Requirements: 17.1, 17.2
 */

interface PortfolioFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (portfolio: Portfolio) => void;
  portfolio?: Portfolio | null;
  planId: string;
}

interface FormData {
  name: string;
  description: string;
  initialBalance: string;
}

interface ValidationErrors {
  [key: string]: string;
}

function buildInitialForm(portfolio?: Portfolio | null): FormData {
  if (portfolio) {
    return {
      name: portfolio.name,
      description: portfolio.description,
      initialBalance: String(portfolio.initialBalance),
    };
  }
  return { name: '', description: '', initialBalance: '' };
}

function validate(form: FormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.name.trim()) errors.name = 'Portfolio name is required';
  const balance = Number(form.initialBalance);
  if (form.initialBalance === '' || isNaN(balance)) {
    errors.initialBalance = 'Initial balance is required';
  } else if (balance < 0) {
    errors.initialBalance = 'Initial balance must be non-negative';
  }
  return errors;
}

export default function PortfolioForm({
  isOpen,
  onClose,
  onSave,
  portfolio,
  planId,
}: PortfolioFormProps) {
  const [form, setForm] = useState<FormData>(() => buildInitialForm(portfolio));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const isEdit = !!portfolio;

  useEffect(() => {
    setForm(buildInitialForm(portfolio));
    setErrors({});
  }, [portfolio, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (prev[name]) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return prev;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const now = new Date();
    const saved: Portfolio = {
      id: portfolio?.id ?? uuidv4(),
      name: form.name.trim(),
      description: form.description.trim(),
      initialBalance: Number(form.initialBalance),
      planId,
      createdAt: portfolio?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Portfolio' : 'Create Portfolio'}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="portfolio-form">
        <Input
          label="Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          placeholder="e.g. Main Brokerage Account"
        />
        <div className="w-full">
          <label
            htmlFor="portfolio-description"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            Description
          </label>
          <textarea
            id="portfolio-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent placeholder-gray-400"
            placeholder="Optional description..."
          />
        </div>
        <Input
          label="Initial Balance"
          name="initialBalance"
          type="number"
          step="0.01"
          min="0"
          value={form.initialBalance}
          onChange={handleChange}
          error={errors.initialBalance}
          placeholder="e.g. 50000"
        />
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {isEdit ? 'Update Portfolio' : 'Create Portfolio'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
