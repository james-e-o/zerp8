"use client";

import { useState } from "react";
import { Button,buttonVariants } from "@/components/ui/button";
import { Building2, Mail, Phone, Edit3, Save, X } from "lucide-react";

export default function CompanyInfoSettings() {
  const [company, setCompany] = useState({
    name: "Nexshelf Technologies Ltd",
    email: "info@nexshelf.com",
    phone: "+234 800 000 0000",
  });

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(company);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    setTimeout(() => {
      setCompany(formData);
      setEditMode(false);
      setLoading(false);
    }, 1000);
  };

  const handleCancel = () => {
    setFormData(company);
    setEditMode(false);
  };

  return (
    <div className="min-h-screen pt-2 font-WixMade">
      <div className="mx-auto bg-white rounded-xl px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h1 className="text-base font-semibold text-gray-800">Company Information</h1>
          </div>

          {!editMode ? (
            <Button
                variant={'secondary'}
              onClick={() => setEditMode(true)}
              className="flex items-center hover:bg-[#fbfbfb] gap-1 px-2 py-1 text-xs font-medium h-8 rounded-md  transition"
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition"
              >
                <Save className="w-3 h-3" />
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-100 transition"
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="divide-y divide-gray-200 text-xs">
          {/* Company Name */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500">Company Name</p>
              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{company.name}</p>
              ) : (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          </div>

          {/* Company Email */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400" /> Company Email
              </p>
              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{company.email}</p>
              ) : (
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          </div>

          {/* Company Phone */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" /> Phone Number
              </p>
              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{company.phone}</p>
              ) : (
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1 border border-gray-300 rounded-md px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
