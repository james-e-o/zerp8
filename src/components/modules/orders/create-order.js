'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Save } from 'lucide-react';

export default function CreateOrderPage() {
  const [orderForm, setOrderForm] = useState({
    orderNumber: '',
    customerName: '',
    deliveryAddress: '',
    promisedDate: '',
    notes: '',
    lineItems: []
  });

  const [lineItem, setLineItem] = useState({
    productName: '',
    quantity: '',
    unitPrice: ''
  });

  const addLineItem = () => {
    if (lineItem.productName && lineItem.quantity && lineItem.unitPrice) {
      setOrderForm({
        ...orderForm,
        lineItems: [...orderForm.lineItems, lineItem]
      });
      setLineItem({ productName: '', quantity: '', unitPrice: '' });
    }
  };

  const removeLineItem = (index) => {
    setOrderForm({
      ...orderForm,
      lineItems: orderForm.lineItems.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        
        {/* Order Header */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
            <Input placeholder="Auto-generated" disabled className="bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Promised Date</label>
            <Input type="date" value={orderForm.promisedDate} onChange={(e) => setOrderForm({...orderForm, promisedDate: e.target.value})} />
          </div>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <Input 
              placeholder="Select or type customer name" 
              value={orderForm.customerName}
              onChange={(e) => setOrderForm({...orderForm, customerName: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
            <Input 
              placeholder="Delivery address" 
              value={orderForm.deliveryAddress}
              onChange={(e) => setOrderForm({...orderForm, deliveryAddress: e.target.value})}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Line Items</h3>
          
          <div className="space-y-4">
            {/* Add Line Item Form */}
            <div className="grid grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg">
              <Input 
                placeholder="Product" 
                value={lineItem.productName}
                onChange={(e) => setLineItem({...lineItem, productName: e.target.value})}
              />
              <Input 
                placeholder="Quantity" 
                type="number"
                value={lineItem.quantity}
                onChange={(e) => setLineItem({...lineItem, quantity: e.target.value})}
              />
              <Input 
                placeholder="Unit Price" 
                type="number"
                value={lineItem.unitPrice}
                onChange={(e) => setLineItem({...lineItem, unitPrice: e.target.value})}
              />
              <Button onClick={addLineItem} className="bg-core hover:bg-core/80 text-white flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Line Items List */}
            {orderForm.lineItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-center">Quantity</th>
                      <th className="px-4 py-2 text-right">Unit Price</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderForm.lineItems.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.productName}</td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">₦{parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₦{(item.quantity * item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => removeLineItem(index)} className="text-red-600 hover:text-red-800">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Notes</label>
          <Textarea 
            placeholder="Special instructions, delivery notes, etc." 
            value={orderForm.notes}
            onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})}
            rows={4}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end border-t pt-6">
          <Button variant="outline">Cancel</Button>
          <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
            <Save className="h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>
    </div>
  );
}
