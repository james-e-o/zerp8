'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function TransferOwnershipForm({ data,cancel }) {
  const [formData, setFormData] = useState({
    companyName: data?.companyName || '',
    currentUserEmail: data?.owner || '',
    newOwnerEmail: '',
    additionalNotes: '',
    confirmation: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Connect to backend API or Google Form submission
    console.log("Transfer Request Submitted:", formData);
    alert("Transfer request submitted successfully!");
  };

  return (
    <form onSubmit={handleSubmit} className="py-5 ml-2 md:px-3 space-y-3">
      <h2 className="text-sm font-bold">Transfer Ownership of Company</h2>
      <p className="text-xs text-gray-600">
        Fill out the details below to initiate the transfer of company ownership.
      </p>

      <div>
        <p className="text-gray-800 mt-1 font-medium">Company Name</p>
        <input
          type="text"
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          className="mt-1 text-xs border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          required
        />
      </div>

      <div>
        <p className="text-gray-800 mt-1 font-medium">Your Email (Current Owner)</p>
        <input
          type="email"
          name="currentUserEmail"
          value={formData.currentUserEmail}
          onChange={handleChange}
          className="mt-1 text-xs border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          required
        />
      </div>

      <div>
        <p className="text-gray-800 mt-1 font-medium">New Owner's Email</p>
        <input
          type="email"
          name="newOwnerEmail"
          value={formData.newOwnerEmail}
          onChange={handleChange}
          className="mt-1 text-xs border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          required
        />
      </div>

      <div>
        <p className="text-gray-800 mt-1 font-medium">Additional Notes (Optional)</p>
        <Textarea
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          className="mt-1 text-xs border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Any notes or instructions for the new owner..."
        />
      </div>

      <div>
        <label className="flex items-start space-x-2">
          <input
            type="checkbox"
            name="confirmation"
            checked={formData.confirmation}
            onChange={handleChange}
            required
            className="mt-1"
          />
          <span className="text-xs text-gray-800">
            I, being satisfied that all conditions for this transfer have been met,<br /> hereby 
            agree to transfer ownership of the company to the email specified above and assume 
            all associated responsibilities and obligations.
          </span>
        </label>
      </div>

      <Button type="submit" className="h-7 bg-army hover:bg-army/80 px-3 text-xs">
        Submit Transfer Request
      </Button>
      <Button onClick={cancel} type='reset' variant={'secondary'} className="h-7 ml-4  hover:bg-neutral-200 px-3 text-xs">
        cancel
      </Button>
    </form>
  );
}

